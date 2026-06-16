import { ImportForm } from './import-form';

export default function ImportPage() {
  return (
    <main className="p-6 max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">批量导入案件</h1>
      <p className="text-sm text-muted-foreground">
        下载 <a className="text-blue-600 underline" href="/templates/import-template.xlsx">导入模板</a> 填写后上传。
      </p>
      <ImportForm />
    </main>
  );
}
