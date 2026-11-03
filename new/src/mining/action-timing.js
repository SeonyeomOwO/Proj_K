// One clock drives hands, the fragment, the sound cue and the actual bank event.
export const ACTION={pickup:.54,grasp:.12,deposit:.58,release:.15,land:.4};
export const smoothStep=x=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
