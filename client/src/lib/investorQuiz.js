// Each option is tagged with the investor type it leans toward; the type
// with the most tags at the end wins (ties broken by question order, i.e.
// whichever type reaches the lead first stays there since later ties don't
// overtake — good enough for a fun result, not meant to be rigorous).
export const INVESTOR_TYPES = {
  turtle: {
    title: 'The Cautious Turtle',
    icon: 'sprout',
    description:
      "You prioritize safety and steady, predictable growth over big swings. You're unlikely to panic-sell, mostly because you rarely take on enough risk to panic about in the first place — but that same caution can leave real growth on the table over decades. Worth asking whether some of that \"safe\" money could handle a little more risk for a long-term goal.",
  },
  diamond: {
    title: 'The Diamond-Handed HODLer',
    icon: 'medal',
    description:
      "You pick your positions and hold through the noise, trusting time in the market over timing it. That patience is one of investing's real edges. Just make sure you're holding because you still believe in the position — not because admitting you were wrong feels worse than the loss.",
  },
  daredevil: {
    title: 'The Day-Trading Daredevil',
    icon: 'zap',
    description:
      "You're energized by fast moves and you're not afraid to swing big. That appetite for risk can pay off, but it also means bigger drawdowns and more moments where one emotional decision gets expensive. A small safety net goes a long way without giving up the thrill.",
  },
  strategist: {
    title: 'The Strategist',
    icon: 'scale',
    description:
      "You think in terms of balance, allocation, and a repeatable process rather than any single bet. That discipline is one of the best predictors of long-term success in every study on the subject — the tradeoff is that it's rarely exciting week to week.",
  },
};

export const INVESTOR_QUIZ_QUESTIONS = [
  {
    question: 'A stock you own drops 20% overnight on bad news. What do you do?',
    options: [
      { label: 'Sell immediately to stop the bleeding', type: 'turtle' },
      { label: "Hold — I'm not selling at a loss", type: 'diamond' },
      { label: 'Buy more — lower price, better deal', type: 'daredevil' },
      { label: 'Check how it affects my overall balance and adjust if needed', type: 'strategist' },
    ],
  },
  {
    question: "How much of your portfolio would you put into a single hot stock everyone's talking about?",
    options: [
      { label: "None — that's too risky for me", type: 'turtle' },
      { label: "A little, and I'd hold it long-term no matter what", type: 'diamond' },
      { label: 'As much as I can — go big or go home', type: 'daredevil' },
      { label: 'A small, capped slice as part of a diversified mix', type: 'strategist' },
    ],
  },
  {
    question: 'Your investing time horizon is...',
    options: [
      { label: 'I want my money safe and accessible soon', type: 'turtle' },
      { label: "Decades — I won't touch this money for a long time", type: 'diamond' },
      { label: 'I like quick trades, not sitting around', type: 'daredevil' },
      { label: 'It depends on the goal — different money, different horizons', type: 'strategist' },
    ],
  },
  {
    question: 'How often do you check your portfolio?',
    options: [
      { label: 'Rarely — checking often just stresses me out', type: 'turtle' },
      { label: 'Occasionally, mostly to remind myself why I’m holding', type: 'diamond' },
      { label: 'Constantly — sometimes minute to minute', type: 'daredevil' },
      { label: 'On a regular schedule, like once a month', type: 'strategist' },
    ],
  },
  {
    question: 'A friend asks for investing advice. You say...',
    options: [
      { label: 'Put it somewhere safe, like bonds or savings', type: 'turtle' },
      { label: 'Buy good companies and never sell', type: 'diamond' },
      { label: 'Find the next big mover and time it right', type: 'daredevil' },
      { label: 'Diversify, and match your risk to your goals', type: 'strategist' },
    ],
  },
  {
    question: 'The market drops 30% in a month. Your reaction?',
    options: [
      { label: 'This confirms investing is too risky for me', type: 'turtle' },
      { label: 'Great, more shares for the same money eventually', type: 'diamond' },
      { label: 'Exciting! Volatility means opportunity', type: 'daredevil' },
      { label: 'Time to rebalance and stick to the plan', type: 'strategist' },
    ],
  },
  {
    question: 'Pick a motto:',
    options: [
      { label: 'Better safe than sorry', type: 'turtle' },
      { label: 'Time in the market beats timing the market', type: 'diamond' },
      { label: 'Fortune favors the bold', type: 'daredevil' },
      { label: "Don't put all your eggs in one basket", type: 'strategist' },
    ],
  },
];
