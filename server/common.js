var env = process.env.NODE_ENV || 'development';

var crypto = require('crypto');

var config = require('./config.' + env + '.json');

function crypt(str) {
    var cipher = crypto.createCipher('aes-256-cbc', config.aes_key);
    cipher.setAutoPadding(true);

    var t = [];
    t.push(cipher.update(str, 'utf-8', 'hex'));
    t.push(cipher.final('hex'));
    return t.join('');
}

console.log(crypt('BOT:example@gmail.com'));
console.log(crypt('ermilov.maxim@gmail.com'));
console.log(crypt('example@gmail.com'));

function decrypt(str) {
    // FIXME: verify data
    var decipher = crypto.createDecipher('aes-256-cbc', config.aes_key);
    var t = [];
    t.push(decipher.update(str, 'hex', 'utf-8'));
    t.push(decipher.final('utf-8'));
    return t.join('');
}

exports.clone = function(obj) {
    return JSON.parse(JSON.stringify(obj));
}

exports.shuffle = function(o){
    for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
};

exports.crypt = crypt;
exports.decrypt = decrypt;
exports.config = config;
exports.DECK_SIZE = 30;
