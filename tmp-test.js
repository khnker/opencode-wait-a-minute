const { detectCouplingIntent } = require('./src/context/selection.js');
console.log('"refactor the user service":', detectCouplingIntent("refactor the user service"));
console.log('"coupling":', detectCouplingIntent("coupling"));
console.log('"read src/context/coupling.js":', detectCouplingIntent("read src/context/coupling.js"));
console.log('"":', detectCouplingIntent(""));
console.log('"trace cross-layer coupling for src/api/user.ts":', detectCouplingIntent("trace cross-layer coupling for src/api/user.ts"));