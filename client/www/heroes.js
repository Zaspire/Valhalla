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
        img: "1.png",
        cast: function(card) {
            card.attack = String(function(card1, card2) {
                card1.attack = undefined;
                var d = Math.min(4, card2.health);
                card2.health -= d;
                card1.health += d;
            });
        },
        ultimateDescription: "Feasts on minion flesh. Deal 4 damage"
    },
    h2: {
        cardType: CardType.HERO,
        name: "Slayer",
        damage: 5,
        health: 4,
        cost: 4,
        img: "2.png",
        cast: function(card, cards) {
            for (var i = 0; i < cards.length; i++) {
                if (card.owner == cards[i].owner)
                    continue;
                if (cards[i].state === TABLE) {
                    cards[i].health--;
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
        img: "3.png"
    },
    h4: {
        cardType: CardType.HERO,
        name: "The Ent",
        damage: 4,
        health: 4,
        cost: 4,
        shield: true,
        img: "4.png"
    },
    h5: {
        cardType: CardType.HERO,
        name: "Dark Angel",
        damage: 2,
        health: 3,
        cost: 2,
        img: "5.png"
    },
    h6: {
        cardType: CardType.HERO,
        name: "Bloody Axe",
        damage: 1,
        health: 4,
        cost: 2,
        shield: true,
        img: "6.png"
    },
    h7: {
        cardType: CardType.HERO,
        name: "Frozen Virgin",
        damage: 3,
        health: 6,
        cost: 4,
        img: "7.png",
        cast: function(card, cards, model) {
            var minions = cards.filter(function(c) {
                if (card.owner == c.owner)
                    return false;
                if (c.state !== TABLE)
                    return false;
                return true;
            });

            var chozen = [];
            for (var i = 0; i < minions.length; i++) {
                var b = (model.random() % 1000) / 1000;

                if (b > (2 - chozen.length)/(minions.length - i))
                    continue;
                chozen.push(minions[i]);
            }
            for (var i = 0; i < chozen.length; i++) {
                chozen[i].health -= 3;
            }
        },
        ultimateDescription: "Deal 3 damage to 2 random enemy minions.",
    },
    h8: {
        cardType: CardType.HERO,
        name: "Stone Giant",
        damage: 3,
        health: 5,
        cost: 3,
        shield: true,
        img: "8.png",
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
        img: "9.png",
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
        img: "10.png",
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
        img: "11.png",
        cast: function(card, cards) {
            for (var i = 0; i < cards.length; i++) {
                if (card.owner == cards[i].owner)
                    continue;
                if (cards[i].state === TABLE) {
                    cards[i].health -= 2;
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
        img: "12.png"
    },
    h13: {
        cardType: CardType.HERO,
        name: "The Troll",
        damage: 2,
        health: 2,
        cost: 4,
        img: "13.png",
        onPlay: {
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
        img: "14.png",
        cast: function(card, cards) {
            var bonus = 0;
            for (var i = 0; i < cards.length; i++) {
                if (card.owner == cards[i].owner)
                    continue;
                if (cards[i].state === TABLE) {
                    cards[i].health -= 2;
                    bonus += 2;
                }
            }
            card.health += bonus;
        },
        ultimateDescription: "Steal 2 health from all enemy minions"

    },
    h15: {
        cardType: CardType.HERO,
        name: "Riki",
        damage: 1,
        health: 2,
        cost: 3,
        img: "15.png",
        onTurnEnd: {
            cast: function(card) {
                if (card.attacksLeft) {
                    card.health++;
                    card.damage++;
                }
            }
        },
        description: [
            "For each idle turn gets +1,+1"
        ],
    },
    h16: {
        cardType: CardType.HERO,
        name: "Ranger",
        damage: 8,
        health: 5,
        cost: 7,
        img: "16.png"
    },
    h17: {
        cardType: CardType.HERO,
        name: "Omniknight",
        damage: 3,
        health: 5,
        cost: 3,
        img: "17.png"
    },
    h18: {
        cardType: CardType.HERO,
        name: "Nerub",
        damage: 2,
        health: 5,
        cost: 4,
        img: "18.png",
        cast: function(card) {
            if (card.__prevTurnHealth) {
                card.health += card.__prevTurnHealth;
            }
        },
        ultimateDescription: "Add health from previous turn",
        onPlay: {
            cast: function(card) {
                card.__prevTurnHealth = card.health;
            }
        },
        onNewTurn: {
            cast: function(card) {
                card.__prevTurnHealth = card.health;
            }
        }
    },
    h19: {
        cardType: CardType.HERO,
        name: "Enchantress",
        damage: 6,
        health: 4,
        cost: 6,
        img: "19.png",
        cast: function(card, cards) {
            for (var i = 0; i < cards.length; i++) {
                if (card.owner != cards[i].owner)
                    continue;
                if (cards[i].state === TABLE) {
                    cards[i].health--;
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
        img: "20.png",
        shield: true
    },
    h21: {
        cardType: CardType.HERO,
        name: "Sniper",
        damage: 6,
        health: 2,
        cost: 4,
        img: "21.png",
        cast: function(card) {
            card.attack = String(function(card1, card2) {
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
        img: "22.png",
    },

    creep1: {
        cardType: CardType.HERO,
        name: "Weak Creep",
        damage: 1,
        health: 1,
        cost: 1,
    },
    bear: {
        cardType: CardType.HERO,
        name: "Bear",
        damage: 3,
        health: 7,
        cost: 0,
        img: "1001.png"
    },

    chainArmor: {
        cardType: CardType.SPELL,
        name: "Chain Armor",
        cost: 3,
        cast: function(card) {
            card.health += 2;
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
        cast: function(card, cards, model) {
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
