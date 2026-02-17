function rollDice(expression) {
  const match = expression.trim().match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!match) {
    throw new Error("Invalid dice format");
  }

  const numDice = parseInt(match[1]) || 1;
  const sides = parseInt(match[2]);
  const modifier = parseInt(match[3]) || 0;

  if (numDice < 1 || numDice > 100) {
    throw new Error("Too many dice");
  }

  if (sides < 2 || sides > 1000) {
    throw new Error("Invalid dice sides");
  }

  const rolls = [];
  let total = 0;

  for (let i = 0; i < numDice; i++) {
    const roll = Math.floor(Math.random() * sides) + 1;
    rolls.push(roll);
    total += roll;
  }

  total += modifier;

  return {
    expression,
    rolls,
    modifier,
    total
  };
}

module.exports = { rollDice };
