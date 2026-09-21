import { Card, Muted, Page, Title } from "./ui";

export default function ComingSoon({ title, blurb }: { title: string; blurb: string }) {
  return (
    <Page>
      <Title size={32}>{title}</Title>
      <Card className="flex flex-col gap-1.5">
        <div className="text-[15px] font-bold">Coming in a later update</div>
        <Muted>{blurb}</Muted>
      </Card>
    </Page>
  );
}
