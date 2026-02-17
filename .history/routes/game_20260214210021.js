const router = require("express").Router();

//dice roller

router.post("/roll", (req, res) => {
    //parse the dice (1d6, 2d10 etc)
    const { dice } = req.body;
    const match = dice.match(/(\d*)d(\d+)/);
    if (!match) {
        return res.status(400).json({ error: "Invalid dice format" });
    }

    const numDice = parseInt(match[1]) || 1;
    const sides = parseInt(match[2]);
    if (numDice < 1 || sides < 2) {
        return res.status(400).json({ error: "Invalid dice parameters" });
    }
    
    let total = 0;
    const rolls = [];
    for (let i = 0; i < numDice; i++) {
        const roll = Math.floor(Math.random() * sides) + 1;
        total += roll;
        rolls.push(roll);
    }

    res.json({ dice, rolls, total });
});