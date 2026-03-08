import { Editor } from "@/components/Editor";

interface Props {
  params: Promise<{ docId: string }>;
}

export default async function EditorPage({ params }: Props) {
  const { docId } = await params;
  return <Editor docId={docId} />;
}
