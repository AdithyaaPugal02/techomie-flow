import { QuotationWorkspaceRoute } from "../../../quotations-module";

export default async function PreviewQuotationPage(
  props: PageProps<"/quotations/[quotationId]/preview">,
) {
  const { quotationId } = await props.params;
  return <QuotationWorkspaceRoute quotationId={Number(quotationId)} mode="preview" />;
}
