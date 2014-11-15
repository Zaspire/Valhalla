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
        img: "1.png"
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
        img: "7.png"
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
        img: "9.png"
    },
    h10: {
        cardType: CardType.HERO,
        name: "The Sea Dragon",
        damage: 2,
        health: 5,
        cost: 3,
        img: "10.png"
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
        ultimateDescription: "Deal 2 damage to enemy minions"
    },
    h12: {
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
        img: "13.png"
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
        img: "15.png"
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
        img: "18.png"
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
        img: "21.png"
    },

    creep1: {
        cardType: CardType.HERO,
        name: "Weak Creep",
        damage: 1,
        health: 1,
        cost: 1,
    },

    chainArmor: {
        cardType: CardType.SPELL,
        name: "Chain Armor",
        cost: 3,
        cast: function(card) {
            card.health += 2;
            card.damage += 1;
        }
    },
    ultimate: {
        cardType: CardType.SPELL,
        name: "Ultimate",
        cost: 2,
        cast: function(card, cards) {
            heroes[card.type].cast(card, cards);
        }
    }
};

if (typeof exports !== 'undefined') {
    exports.heroes = heroes;
    exports.AbilityType = AbilityType;
    exports.CastType = CastType;
    exports.CardType = CardType;
}
