// Seconds of real time. Shared by the 3D scene and the React overlay (kept tiny so it does not pull in three.js).
// CONTACT = the moment the banner and crowd sound start (the bat hits, the stumps fall, the catch is taken, the trophy appears).
// The 3D scene slows down for a moment on impact, which is why these are a little longer than the action itself.
// catch: the ball is hit high, flies for 2.6 s and is caught (banner at the catch). runout: a quick single, the throw hits the stumps (banner at the stumps).
export const DURATION = { four: 7.2, six: 7.8, wicket: 7.2, catch: 8.6, runout: 9.2, win: 7.0, milestone: 9.0 };
export const CONTACT = { four: 2.05, six: 2.05, wicket: 2.05, catch: 5.2, runout: 5.4, win: 0.4, milestone: 0.5 };
export const MILESTONES = [200, 150, 100, 50];
export const MILESTONE_LABEL = { 50: 'HALF CENTURY', 100: 'CENTURY', 150: '150 RUNS', 200: 'DOUBLE CENTURY' };
