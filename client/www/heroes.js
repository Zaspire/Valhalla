var CastType = {
    ON_DEATH: "On Death",
    BATTLE_CRY: "Battle Cry"
};
var AbilityType = {
    DAMAGE_TO_ALL: "deal 1 damage to ALL",
};
var CardType = {
    UNKNOWN: 0,
    SPELL: 1,
    HERO: 2
};


//FIXME:
var TABLE = 3;

var heroes = {
    h1: {
        cardType: CardType.HERO,
        name: "Butcher",
        damage: 1,
        health: 5,
        cost: 3,
        img: "1.webp",
        cast: function(card) {
            if (card.visualState.length)
                card.visualState += ',ulti';
            else
                card.visualState = 'ulti';

            card.attack = String(function(card1, card2, model) {
                card1.attack = undefined;
                var d = model.dealDamageToCard(4);
                if (d > 0)
                    model.increaseCardHealth(card, d);

                var visual = card1.visualState.split(',');
                var i = visual.indexOf('ulti');
                if (i != -1)
                    visual.splice(i, 1);
                card1.visualState = visual.join(',');
            });
        },
        onTurnEnd: {
            cast: function(card, cards, model) {
                var minions = cards.filter(function(c) {
                    if (card.owner == c.owner)
                        return false;
                    if (c.state !== CardState.TABLE)
                        return false;
                    return true;
                });
                minions.sort(function(c1, c2) {
                    if (c1.id < c2.id) {
                        return -1;
                    }
                    if (c1.id > c2.id) {
                        return 1;
                    }
                    return 0;
                });
                var chozen = [];
                for (var i = 0; i < minions.length; i++) {
                    var b = (model.random() % 1000) / 1000;
                    if (b > (3 - chozen.length)/(minions.length - i))
                        continue;
                    chozen.push(minions[i]);
                }
                for (var i = 0; i < chozen.length; i++) {
                    model.dealDamageToCard(chozen[i], 1);
                }
                model.dealDamageToCard(card, 1);
            }
        },
        description: [
            "At the end of each turn deal 1 damage to self and 3 random enemy minions"
        ],
        ultimateDescription: "Feasts on minion flesh. Deal 4 damage"
    },
    h2: {
        cardType: CardType.HERO,
        name: "Slayer",
        damage: 5,
        health: 4,
        cost: 4,
        img: "2.webp",
        cast: function(card, cards, model) {
            for (var i = 0; i < cards.length; i++) {
                if (card.owner == cards[i].owner)
                    continue;
                if (cards[i].state === TABLE) {
                    model.dealDamageToCard(cards[i], 1);
                }
            }
        },
        ultimateDescription: "Deal 1 damage to enemy minions"
    },
    h3: {
        cardType: CardType.HERO,
        name: "Medusa",
        damage: 2,
        health: 5,
        cost: 3,
        img: "3.webp",
        cast: function(card, cards, model) {
            var minions = cards.filter(function(c) {
                if (card.owner == c.owner)
                    return false;
                if (c.state !== TABLE)
                    return false;
                return true;
            });
            minions.sort(function(c1, c2) {
                if (c1.id < c2.id) {
                    return -1;
                }
                if (c1.id > c2.id) {
                    return 1;
                }
                return 0;
            });
            var chozen = [];
            for (var i = 0; i < minions.length; i++) {
                var b = (model.random() % 1000) / 1000;
                if (b > (2 - chozen.length)/(minions.length - i))
                    continue;
                chozen.push(minions[i]);
            }

            //FIXME:
            function filter(obj) {
                var hooks = [ 'onDeath', 'onNewTurn', 'attack', 'onPlay', 'onTurnEnd', 'canAttackCard', 'canBeAttacked'];

                for (var i = 0; i < hooks.length; i++) {
                    obj[hooks[i]] = undefined;
                }
            }
            for (var i = 0; i < chozen.length; i++) {
                filter(chozen[i]);
                chozen[i].visualState = '';
                chozen[i].type = 'rock';
                chozen[i].damage = heroes['rock'].damage;
                chozen[i].health = heroes['rock'].health;
                chozen[i].maxHealth = heroes['rock'].health;
                chozen[i].shield = heroes['rock'].shield;
                chozen[i].attacksLeft = 0;
            }
        },
        ultimateDescription: "Transform 2 random enemy minions into 0/3 Rock.",
    },
    h4: {
        cardType: CardType.HERO,
        name: "The Ent",
        damage: 4,
        health: 4,
        cost: 4,
        shield: true,
        img: "4.webp"
    },
    h5: {
        cardType: CardType.HERO,
        name: "Dark Angel",
        damage: 2,
        health: 3,
        cost: 2,
        img: "5.webp",
        cast: function(card) {
            if (card.visualState.length)
                card.visualState += ',ulti';
            else
                card.visualState = 'ulti';

            card.attack = String(function(card1, card2, model) {
                if (card2.damage <= 4) {
                    card1.attack = undefined;

                    model.increaseCardHealth(card1, card2.health);
                    card2.health = 0;

                    var visual = card1.visualState.split(',');
                    var i = visual.indexOf('ulti');
                    if (i != -1)
                        visual.splice(i, 1);
                    card1.visualState = visual.join(',');

                    return;
                }
                //FIXME:
                var damage1 = card1.damage;
                var damage2 = card2.damage;
                model.dealDamageToCard(card2, damage1);
                model.dealDamageToCard(card1, damage2);
            });
        },
        ultimateDescription: "Eats enemy minion with 4 or less attack."
    },
    h6: {
        cardType: CardType.HERO,
        name: "Bloody Axe",
        damage: 1,
        health: 4,
        cost: 2,
        shield: true,
        img: "6.webp",
        cast: function(card) {
            if (card.visualState.length)
                card.visualState += ',ulti';
            else
                card.visualState = 'ulti';

            card.attack = String(function(card1, card2) {
                card1.attack = undefined;

                if (card2.maxHealth > card2.health)
                    card2.health = 0;
                else
                    card2.health = 1;

                var visual = card1.visualState.split(',');
                var i = visual.indexOf('ulti');
                if (i != -1)
                    visual.splice(i, 1);
                card1.visualState = visual.join(',');
            });
        },
        ultimateDescription: "Kill damaged minion. Leave 1 health to undamaged"
    },
    h7: {
        cardType: CardType.HERO,
        name: "Frozen Virgin",
        damage: 3,
        health: 6,
        cost: 4,
        img: "7.webp",
        cast: function(card, cards, model) {
            var minions = cards.filter(function(c) {
                if (card.owner == c.owner)
                    return false;
                if (c.state !== TABLE)
                    return false;
                return true;
            });
            minions.sort(function(c1, c2) {
                if (c1.id < c2.id) {
                    return -1;
                }
                if (c1.id > c2.id) {
                    return 1;
                }
                return 0;
            });
            var chozen = [];
            for (var i = 0; i < minions.length; i++) {
                var b = (model.random() % 1000) / 1000;
                if (b > (2 - chozen.length)/(minions.length - i))
                    continue;
                chozen.push(minions[i]);
            }
            function froze(c1) {
                if (!c1._t_newTurn)
                    c1._t_newTurn = [];
                c1._t_newTurn.push(c1.onNewTurn);

                if (c1.visualState.length)
                    c1.visualState += ',frozen';
                else
                    c1.visualState = 'frozen';
                c1.onNewTurn = {
                    cast: String(function(card) {
                        card.attacksLeft = 0;
                        var visual = card.visualState.split(',');
                        var i = visual.indexOf('frozen');
                        if (i != -1)
                            visual.splice(i, 1);
                        card.visualState = visual.join(',');
                        card.onNewTurn = card._t_newTurn.pop();
                    })
                };
            }
            for (var i = 0; i < chozen.length; i++) {
                model.dealDamageToCard(chozen[i], 3);
                froze(chozen[i]);
            }
        },
        ultimateDescription: "Deal 3 damage to 2 random enemy minions and freeze them.",
    },
    h8: {
        cardType: CardType.HERO,
        name: "Stone Giant",
        damage: 3,
        health: 5,
        cost: 3,
        shield: true,
        img: "8.webp",
        cast: function(card, cards) {
            card.damage *= 3;
        },
        ultimateDescription: "Gain 3x damage"
    },
    h9: {
        cardType: CardType.HERO,
        name: "Druid",
        damage: 5,
        health: 3,
        cost: 7,
        img: "9.webp",
        onPlay: {
            cast: function(card, model) {
                var card = {
                    cardType: heroes['bear'].cardType,
                    name: heroes['bear'].name,
                    damage: heroes['bear'].damage,
                    health: heroes['bear'].health,
                    cost: heroes['bear'].cost,
                    id:  model.data.nextId++,
                    state: CardState.TABLE,
                    owner: card.owner,
                    attacksLeft: 0,

                    type: 'bear'
                };
                model.createCard(card);
            }
        },
        description: [
            "Summon bear."
        ],
    },
    h10: {
        cardType: CardType.HERO,
        name: "The Sea Dragon",
        damage: 2,
        health: 5,
        cost: 3,
        img: "10.webp",
        cast: function(card, cards) {
            card.__ultimate = true;
        },
        ultimateDescription: "Add 4 damage each turn.",
        onNewTurn: {
            cast: function(card) {
                if (card.__ultimate)
                    card.damage += 4;
            }
        }
    },
    h11: {
        cardType: CardType.HERO,
        name: "Zeus",
        damage: 3,
        health: 6,
        cost: 4,
        img: "11.webp",
        cast: function(card, cards) {
            for (var i = 0; i < cards.length; i++) {
                if (card.owner == cards[i].owner)
                    continue;
                if (cards[i].state === TABLE) {
                    model.dealDamageToCard(cards[i], 2);
                }
            }
        },
        ultimateDescription: "Deal 2 damage to enemy minions."
    },
    h12: {
        description: [
            "Reborn."
        ],
        onDeath: {
            cast: function(card) {
                card.onDeath = undefined;
                card.health = heroes['h12'].health;
                card.type = 'h12';
                card.damage = heroes['h12'].damage;
                card.img = heroes['h12'].img;
                card.shield = false;
            }
        },
        cardType: CardType.HERO,
        name: "The Mad King",
        damage: 2,
        health: 6,
        cost: 5,
        img: "12.webp"
    },
    h13: {
        cardType: CardType.HERO,
        name: "The Troll",
        damage: 2,
        health: 2,
        cost: 4,
        img: "13.webp",
        onPlay: {
            cast: function(card) {
                card.attacksLeft = 2;
            }
        },
        onNewTurn: {
            cast: function(card) {
                card.attacksLeft = 2;
            }
        },
        description: [
            "Charge.",
            "Repeat attack."
        ],
    },
    h14: {
        cardType: CardType.HERO,
        name: "Prophet",
        damage: 3,
        health: 2,
        cost: 2,
        img: "14.webp",
        cast: function(card, cards, model) {
            var bonus = 0;
            for (var i = 0; i < cards.length; i++) {
                if (card.owner == cards[i].owner)
                    continue;
                if (cards[i].state === TABLE && cards[i].health > 0) {
                    bonus += model.dealDamageToCard(cards[i], 2);
                }
            }
            model.increaseCardHealth(card, bonus);
        },
        ultimateDescription: "Steal 2 health from all enemy minions"

    },
    h15: {
        cardType: CardType.HERO,
        name: "Riki",
        damage: 1,
        health: 2,
        cost: 3,
        img: "15.webp",
        onTurnEnd: {
            cast: function(card, cards, model) {
                if (card.attacksLeft) {
                    model.increaseCardHealth(card, 1);
                    card.damage++;
                } else if (!card.__first) {
                    var visual = card.visualState.split(',');
                    var i = visual.indexOf('invisible');
                    if (i != -1)
                        visual.splice(i, 1);
                    card.visualState = visual.join(',');

                    card.visualState = '';
                    card.__invisible = false;
                }
                card.__first = false;
            }
        },
        onPlay: {
            cast: function(card) {
                card.__first = true;
                card.__invisible = true;
                card.visualState = "invisible";
            }
        },
        canBeAttacked: {
            cast: function(card) {
                return !card.__invisible;
            }
        },
        description: [
            "For each idle turn gets +1,+1.",
            "Invisible."
        ],
    },
    h16: {
        cardType: CardType.HERO,
        name: "Ranger",
        damage: 8,
        health: 5,
        cost: 7,
        img: "16.webp"
    },
    h17: {
        cardType: CardType.HERO,
        name: "Omniknight",
        damage: 3,
        health: 5,
        cost: 3,
        img: "17.webp",
        canAttackCard: {
            cast: function(card1, card2, orig) {
                if (card2.owner == card1.owner)
                    return true;
                return orig;
            }
        },
        cast: function(card, cards) {
            if (card.visualState.length)
                card.visualState += ',ulti';
            else
                card.visualState = 'ulti';

            card.__ultimate = true;
        },
        attack: String(function(card1, card2, model) {
            card1.attacksLeft--;
            if (card2.owner == card1.owner) {
                if (card1.__ultimate) {
                    var visual = card1.visualState.split(',');
                    var i = visual.indexOf('ulti');
                    if (i != -1)
                        visual.splice(i, 1);
                    card1.visualState = visual.join(',');

                    card2.shield = true;
                    card1.__ultimate = false;
                    return;
                }
                model.healCard(card2, 2);
                return;
            }
            var damage1 = card1.damage;
            var damage2 = card2.damage;
            model.dealDamageToCard(card2, damage1);
            model.dealDamageToCard(card1, damage2);
        }),
        description: [
            "Can heal friendly minion instead on attack."
        ],
        ultimateDescription: "Give friendly minion shield."
    },
    h18: {
        cardType: CardType.HERO,
        name: "Nerub",
        damage: 2,
        health: 5,
        cost: 4,
        img: "18.webp",
        cast: function(card) {
            if (card.__prevTurnHealth) {
                card.health += card.__prevTurnHealth;
                card.maxHealth = Math.max(card.health, card.maxHealth);
            }
        },
        ultimateDescription: "Add health from previous turn",
        description: [
            "Born spider each turn."
        ],
        onPlay: {
            cast: function(card) {
                card.__prevTurnHealth = card.health;
            }
        },
        onNewTurn: {
            cast: function(card, model) {
                card.__prevTurnHealth = card.health;

                var card = {
                    cardType: heroes['spider'].cardType,
                    name: heroes['spider'].name,
                    damage: heroes['spider'].damage,
                    health: heroes['spider'].health,
                    cost: heroes['spider'].cost,
                    id:  model.data.nextId++,
                    state: CardState.TABLE,
                    owner: card.owner,
                    attacksLeft: 0,

                    type: 'spider'
                };
                model.createCard(card);
            }
        }
    },
    h19: {
        cardType: CardType.HERO,
        name: "Enchantress",
        damage: 6,
        health: 4,
        cost: 6,
        img: "19.webp",
        cast: function(card, cards, model) {
            for (var i = 0; i < cards.length; i++) {
                if (card.owner != cards[i].owner)
                    continue;
                if (cards[i].state === TABLE) {
                    model.increaseCardHealth(cards[i], 3)
                }
            }
        },
        onPlay: {
            cast: function(card) {
                card.attacksLeft = 1;
                card.onPlay = undefined;
            }
        },
        description: [
            "Charge."
        ],
        ultimateDescription: "Give 3 health to friendly minions"
    },
    h20: {
        cardType: CardType.HERO,
        name: "Tauren Chieftain",
        damage: 6,
        health: 9,
        cost: 6,
        img: "20.webp",
        shield: true
    },
    h21: {
        cardType: CardType.HERO,
        name: "Sniper",
        damage: 6,
        health: 2,
        cost: 4,
        img: "21.webp",
        cast: function(card) {
            if (card.visualState.length)
                card.visualState += ',ulti';
            else
                card.visualState = 'ulti';
            card.attack = String(function(card1, card2) {
                var visual = card1.visualState.split(',');
                var i = visual.indexOf('ulti');
                if (i != -1)
                    visual.splice(i, 1);
                card1.visualState = visual.join(',');

                card1.attack = undefined;
                card2.health = 0;
            });
        },
        ultimateDescription: "Kill selected enemy minion"
    },
    h22: {
        cardType: CardType.HERO,
        name: "Untitled hero 21",
        damage: 6,
        health: 2,
        cost: 4,
        img: "22.webp",
    },
    h23: {
        cardType: CardType.HERO,
        name: "Andromeda",
        damage: 1,
        health: 6,
        cost: 3,
        img: "23.png",
        onNewTurn: {
            cast: function(card, model) {
                var controller = model.getController(card.owner);
                controller.drawCard();
            }
        },
        description: [
            "Draw additional card on each turn."
        ]
    },
    h24: {
        cardType: CardType.HERO,
        name: "Untitled hero 24",
        damage: 6,
        health: 2,
        cost: 4,
        img: "24.png",
    },
    h25: {
        cardType: CardType.HERO,
        name: "Untitled hero 25",
        damage: 6,
        health: 2,
        cost: 4,
        img: "25.png",
    },
    h26: {
        cardType: CardType.HERO,
        name: "Swift Claw",
        damage: 3,
        health: 6,
        cost: 4,
        img: "26.png",
        dealDamage: {
            cast: function(card, h, model) {
                var d = 0;
                if (card.__invincible !== 1) {
                    d = Math.min(card.health, h);
                    card.health -= d;
                }

                var controller = model.getController(card.owner);
                controller.drawCard();

                card.damage += 3;

                return d;
            }
        },
        onNewTurn: {
            cast: function(card) {
                if (card.__invincible) {
                    card.__invincible--;
                    if (!card.__invincible) {
                        var visual = card.visualState.split(',');
                        var i = visual.indexOf('ulti');
                        if (i != -1)
                            visual.splice(i, 1);
                        card.visualState = visual.join(',');
                    }
                }
            }
        },
        onTurnEnd: {
            cast: function(card, cards, model) {
                if (card.__invincible) {
                    card.__invincible--;
                    if (card.__invincible) {
                        if (card.visualState.length)
                            card.visualState += ',ulti';
                        else
                            card.visualState = 'ulti';
                    }
                }
            }
        },
        cast: function(card) {
            card.__invincible = 2;
        },

        ultimateDescription: "invincible for next turn",

        description: [
            "Whenever this minion takes damage, draw a card and gain +3 damage"
        ]
    },

    creep1: {
        cardType: CardType.HERO,
        name: "Weak Creep",
        damage: 1,
        health: 1,
        cost: 1,
        img: "1000.webp"
    },
    bear: {
        cardType: CardType.HERO,
        name: "Bear",
        damage: 3,
        health: 7,
        cost: 0,
        img: "1001.webp"
    },
    rock: {
        cardType: CardType.HERO,
        name: "Rock",
        damage: 0,
        health: 3,
        cost: 0,
        shield: true,
        img: "1002.webp"
    },
    spider: {
        cardType: CardType.HERO,
        name: "Spider",
        damage: 1,
        health: 1,
        cost: 0,
        img: "1003.webp"
    },

    chainArmor: {
        cardType: CardType.SPELL,
        name: "Chain Armor",
        cost: 3,
        cast: function(card, cards, model) {
            model.increaseCardHealth(card, 2);
            card.damage += 1;
        },
        description: [
            "Give +1damage/+2health."
        ]
    },
    ultimate: {
        cardType: CardType.SPELL,
        name: "Ultimate",
        cost: 2,
        img: "2001.webp",
        cast: function(card, cards, model) {
            if (heroes[card.type].cast)
                heroes[card.type].cast(card, cards, model);
        }
    }
};

if (typeof exports !== 'undefined') {
    exports.heroes = heroes;
    exports.AbilityType = AbilityType;
    exports.CastType = CastType;
    exports.CardType = CardType;
}
