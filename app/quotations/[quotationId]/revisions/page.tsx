import { QuotationWorkspaceRoute } from "../../../quotations-module";

export default async function QuotationRevisionsPage(
  props: PageProps<"/quotations/[quotationId]/revisions">,
) {
  const { quotationId } = await props.params;
  return <QuotationWorkspaceRoute quotationId={Number(quotationId)} mode="revisions" />;
}
