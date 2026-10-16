export function SectionHeading({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="section-heading">
      <span className="section-number">{number}</span>
      <div><h2>{title}</h2><p>{description}</p></div>
    </div>
  )
}
