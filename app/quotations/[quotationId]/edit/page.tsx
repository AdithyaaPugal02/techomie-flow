import { QuotationWorkspaceRoute } from "../../../quotations-module";

export default async function EditQuotationPage(
  props: PageProps<"/quotations/[quotationId]/edit">,
) {
  const { quotationId } = await props.params;
  return <QuotationWorkspaceRoute quotationId={Number(quotationId)} mode="edit" />;
}
