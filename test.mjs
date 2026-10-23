import {compute,rpm,thinFactor} from './calc.js';
console.log('rpm 400sfm .5in', rpm(400,.5));            // 3056
console.log('thin ae=.05 D=.5', thinFactor(.05,.5));    // 1.667
console.log(compute({sfm:400,d:.5,fpt:.003,z:4,ae:.25,ap:.5,stickout:1.5,maxRpm:10000,maxHp:15,iso:'P'}));
