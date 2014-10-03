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
    creep1: {
        name: "Weak Creep",
        damage: 1,
        health: 1,
        cost: 1,
    },
    creep2: {
        name: "Creep",
        damage: 2,
        health: 2,
        cost: 1,
    },
    creep3: {
        name: "Mega Creep",
        damage: 3,
        health: 3,
        cost: 1,
    }
};

if (typeof exports !== 'undefined') {
    exports.heroes = heroes;
    exports.AbilityType = AbilityType;
    exports.CastType = CastType;
}
