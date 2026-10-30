export interface BookQuote {
  text: string
  author: string
  book: string
}

export const QUOTES = {
  grahamEnemy: {
    text: '投资者最大的问题，甚至他最大的敌人，很可能就是他自己。',
    author: '本杰明·格雷厄姆',
    book: '《聪明的投资者》',
  },
  marksPrepare: {
    text: '你不能预测，但你可以准备。',
    author: '霍华德·马克斯',
    book: '《投资最重要的事》',
  },
  mungerWait: {
    text: '赚大钱不在买卖，而在等待。',
    author: '查理·芒格',
    book: '《穷查理宝典》',
  },
  bogleEnemies: {
    text: '股票基金投资者最大的两个敌人，是成本和情绪。',
    author: '约翰·博格',
    book: '《共同基金常识》',
  },
  houselBehavior: {
    text: '理财结果与智商关系不大，与行为关系很大。',
    author: '摩根·豪泽尔',
    book: '《金钱心理学》',
  },
  lynchOwn: {
    text: '了解你拥有什么，以及为什么拥有它。',
    author: '彼得·林奇',
    book: '《彼得·林奇的成功投资》',
  },
  dimsonRisk: {
    text: '风险意味着，可能发生的事情比实际发生的更多。',
    author: '埃尔罗伊·迪姆森',
    book: '转引自《投资最重要的事》',
  },
  kahnemanChance: {
    text: '我们容易高估自己对世界的理解，低估运气在事件中的作用。',
    author: '丹尼尔·卡尼曼',
    book: '《思考，快与慢》',
  },
} satisfies Record<string, BookQuote>
