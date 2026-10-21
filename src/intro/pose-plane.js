// One textured plane avoids the seams caused by independently rasterized canvas strips.
export class PosePlane {
  constructor(image, width, height) {
    this.image = image;
    this.canvas = document.createElement('canvas');
    this.canvas.width = width; this.canvas.height = height;
    const gl = this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true });
    this.gl = gl;
    if (!gl) return;
    const shader = (type, source) => {
      const result = gl.createShader(type);
      gl.shaderSource(result, source); gl.compileShader(result);
      if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(result));
      return result;
    };
    const vertex = shader(gl.VERTEX_SHADER, `
      attribute vec2 position;
      uniform vec2 viewport, size, anchor;
      uniform vec4 source;
      uniform float angle, focal;
      varying vec2 uv;
      void main() {
        float x = position.x * size.x;
        float y = -position.y * size.y;
        float w = 1.0 + x * sin(angle) / focal;
        vec2 origin = vec2(2.0 * anchor.x / viewport.x - 1.0, 1.0 - 2.0 * anchor.y / viewport.y);
        vec2 offset = vec2(2.0 * x * cos(angle) / viewport.x, -2.0 * y / viewport.y);
        gl_Position = vec4(origin * w + offset, 0.0, w);
        uv = source.xy + vec2(position.x + 0.5, 1.0 - position.y) * source.zw;
      }
    `);
    const fragment = shader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      uniform sampler2D artwork;
      varying vec2 uv;
      void main() { gl_FragColor = texture2D(artwork, uv); }
    `);
    const program = gl.createProgram();
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const vertices = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-.5, 0, .5, 0, -.5, 1, .5, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    this.uniforms = Object.fromEntries(['viewport', 'size', 'anchor', 'source', 'angle', 'focal']
      .map(name => [name, gl.getUniformLocation(program, name)]));
    gl.uniform2f(this.uniforms.viewport, width, height);
    gl.uniform1f(this.uniforms.focal, 1500);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
  }

  draw(context, rect, { x, footY, width, angle }) {
    const height = width * rect[3] / rect[2], cosine = Math.abs(Math.cos(angle));
    if (cosine < .008) return;
    if (Math.abs(angle) < .001 || !this.gl || this.gl.isContextLost()) {
      context.drawImage(this.image, ...rect, x - width * cosine / 2, footY - height, width * cosine, height);
      return;
    }
    const gl = this.gl, u = this.uniforms;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(u.size, width, height); gl.uniform2f(u.anchor, x, footY);
    gl.uniform1f(u.angle, angle);
    gl.uniform4f(u.source, rect[0] / this.image.width, rect[1] / this.image.height,
      rect[2] / this.image.width, rect[3] / this.image.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    context.drawImage(this.canvas, 0, 0);
  }
}
