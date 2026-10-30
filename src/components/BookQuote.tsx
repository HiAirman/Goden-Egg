import clsx from 'clsx'
import type { BookQuote } from '../data/quotes'

export function QuoteLine({
  quote,
  className,
}: {
  quote: BookQuote
  className?: string
}) {
  return (
    <span className={clsx('quote-line', className)}>
      “{quote.text}”
      <cite>— {quote.author}，{quote.book}</cite>
    </span>
  )
}

export function QuoteBlock({
  quote,
  className,
}: {
  quote: BookQuote
  className?: string
}) {
  return (
    <figure className={clsx('book-quote', className)}>
      <blockquote>“{quote.text}”</blockquote>
      <figcaption>— {quote.author}，{quote.book}</figcaption>
    </figure>
  )
}
