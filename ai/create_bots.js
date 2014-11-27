var account = require('../server/account');
var bots = require('./bots').bots;

for (var i = 0; i < bots.length; i++) {
    console.log(bots[i].name);
    account.addBotAccount(bots[i].name, bots[i].email);
}
