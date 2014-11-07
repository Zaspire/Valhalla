var CastType = {
    ON_DEATH: "On Death",
    BATTLE_CRY: "Battle Cry"
};
var AbilityType = {
    DAMAGE_TO_ALL: "deal 1 damage to ALL",
    SHIELD: "shield" // FIXME: Better description
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
        abilities: [{ castType: CastType.ON_DEATH, abilityType: AbilityType.DAMAGE_TO_ALL}],
        name: "Butcher",
        damage: 3,
        health: 5,
        cost: 4,
        img: "1.png"
    },
    h2: {
        cardType: CardType.HERO,
        abilities: [{ castType: CastType.BATTLE_CRY, abilityType: AbilityType.DAMAGE_TO_ALL}],
        name: "Slayer",
        damage: 5,
        health: 3,
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
        }
    },
    h3: {
        cardType: CardType.HERO,
        name: "Medusa",
        damage: 3,
        health: 3,
        cost: 3,
        img: "3.png"
    },
    h4: {
        cardType: CardType.HERO,
        name: "The Ent",
        damage: 4,
        health: 4,
        cost: 4,
        img: "4.png"
    },
    h5: {
        cardType: CardType.HERO,
        name: "Dark Angel",
        damage: 5,
        health: 5,
        cost: 5,
        img: "5.png"
    },
    h6: {
        cardType: CardType.HERO,
        name: "Bloody Axe",
        damage: 6,
        health: 6,
        cost: 6,
        shield: true,
        img: "6.png"
    },
    h7: {
        cardType: CardType.HERO,
        name: "Frozen Virgin",
        damage: 7,
        health: 7,
        cost: 7,
        img: "7.png"
    },
    h8: {
        cardType: CardType.HERO,
        name: "Stone Giant",
        damage: 8,
        health: 8,
        cost: 8,
        shield: true,
        img: "8.png"
    },
    h9: {
        cardType: CardType.HERO,
        name: "Druid",
        damage: 9,
        health: 9,
        cost: 9,
        img: "9.png"
    },
    h10: {
        cardType: CardType.HERO,
        name: "The Sea Dragon",
        damage: 10,
        health: 10,
        cost: 10,
        img: "10.png"
    },
    h11: {
        cardType: CardType.HERO,
        name: "Zeus Untitled Hero 14",
        damage: 11,
        health: 11,
        cost: 10,
        img: "11.png"
    },
    h12: {
        cardType: CardType.HERO,
        name: "The Mad King",
        damage: 12,
        health: 12,
        cost: 10,
        img: "12.png"
    },
    h13: {
        cardType: CardType.HERO,
        name: "The Troll",
        damage: 13,
        health: 13,
        cost: 10,
        img: "13.png"
    },
    h14: {
        cardType: CardType.HERO,
        name: "prophet Untitled Hero 14",
        damage: 14,
        health: 14,
        cost: 10,
        img: "14.png"
    },
    h15: {
        cardType: CardType.HERO,
        name: "rikimaru Untitled Hero 15",
        damage: 14,
        health: 14,
        cost: 10,
        img: "15.png"
    },
    h16: {
        cardType: CardType.HERO,
        name: "traxex Untitled Hero 16",
        damage: 14,
        health: 14,
        cost: 10,
        img: "16.png"
    },
    h17: {
        cardType: CardType.HERO,
        name: "omniknight Untitled Hero 17",
        damage: 14,
        health: 14,
        cost: 10,
        img: "17.png"
    },
    h18: {
        cardType: CardType.HERO,
        name: "nerub Untitled Hero 18",
        damage: 14,
        health: 14,
        cost: 10,
        img: "18.png"
    },
    h19: {
        cardType: CardType.HERO,
        name: "Enchantress Untitled Hero 19",
        damage: 14,
        health: 14,
        cost: 10,
        img: "19.png"
    },
    h20: {
        cardType: CardType.HERO,
        name: "Tauren Chieftain Untitled Hero 20",
        damage: 14,
        health: 14,
        cost: 10,
        img: "20.png"
    },
    h21: {
        cardType: CardType.HERO,
        name: "sniper Hero 21",
        damage: 14,
        health: 14,
        cost: 10,
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
