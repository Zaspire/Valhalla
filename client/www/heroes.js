var CastType = {
    ON_DEATH: "On Death",
    BATTLE_CRY: "Battle Cry"
};
var AbilityType = {
    DAMAGE_TO_ALL: "deal 1 damage to ALL"
};
var heroes = {
    h1: {
        abilities: [{ castType: CastType.ON_DEATH, abilityType: AbilityType.DAMAGE_TO_ALL}],
        name: "Butcher",
        damage: 3,
        health: 5,
        cost: 4,
        img: "1.png"
    },
    h2: {
        abilities: [{ castType: CastType.BATTLE_CRY, abilityType: AbilityType.DAMAGE_TO_ALL}],
        name: "Pyromancer",
        damage: 5,
        health: 3,
        cost: 4,
        img: "2.png"
    },
    h3: {
        name: "Untitled Hero 4",
        damage: 3,
        health: 3,
        cost: 3,
        img: "3.png"
    },
    h4: {
        name: "Untitled Hero 3",
        damage: 4,
        health: 4,
        cost: 4,
        img: "4.png"
    },
    h5: {
        name: "Untitled Hero 5",
        damage: 5,
        health: 5,
        cost: 5,
        img: "5.png"
    },
    h6: {
        name: "Untitled Hero 6",
        damage: 6,
        health: 6,
        cost: 6,
        img: "6.png"
    },
    h7: {
        name: "Untitled Hero 7",
        damage: 7,
        health: 7,
        cost: 7,
        img: "7.png"
    },
    h8: {
        name: "Untitled Hero 8",
        damage: 8,
        health: 8,
        cost: 8,
        img: "8.png"
    },
    h9: {
        name: "Untitled Hero 9",
        damage: 9,
        health: 9,
        cost: 9,
        img: "9.png"
    },
    h10: {
        name: "Untitled Hero 10",
        damage: 10,
        health: 10,
        cost: 10,
        img: "10.png"
    },
    h11: {
        name: "Untitled Hero 11",
        damage: 11,
        health: 11,
        cost: 10,
        img: "11.png"
    },
    h12: {
        name: "Untitled Hero 12",
        damage: 12,
        health: 12,
        cost: 10,
        img: "12.png"
    },
    h13: {
        name: "Untitled Hero 13",
        damage: 13,
        health: 13,
        cost: 10,
        img: "13.png"
    },
    h14: {
        name: "Untitled Hero 14",
        damage: 14,
        health: 14,
        cost: 10,
        img: "14.png"
    },

    creep1: {
        name: "Weak Creep",
        damage: 1,
        health: 1,
        cost: 1,
    }
};

if (typeof exports !== 'undefined') {
    exports.heroes = heroes;
    exports.AbilityType = AbilityType;
    exports.CastType = CastType;
}
