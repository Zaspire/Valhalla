"use strict";
// silly deterministic random number generator
function hash(a) {
    a = (a + 0x7ed55d16) + (a << 12);
    a = (a ^ 0xc761c23c) ^ (a >> 19);
    a = (a + 0x165667b1) + (a << 5);
    a = (a + 0xd3a2646c) ^ (a << 9);
    a = (a + 0xfd7046c5) + (a << 3);
    a = (a ^ 0xb55a4f09) ^ (a >> 16);
    if (a < 0)
        a = 0xffffffff + a;
    return a;
}

function createRandomGenerator(seed) {
    function next() {
        next.state = hash(next.state);
        return next.state % 1000000007;
    }
    next.state = seed;
    return next;
}

var runningUnderNode = typeof exports !== 'undefined';

if (runningUnderNode) {
    exports.createRandomGenerator = createRandomGenerator;
}
