export function DeleteConfirmation({ name, busy, onConfirm, onCancel }: { name: string; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  return <div className="delete-confirmation" role="alert">
    <p>确认删除“{name}”？删除后会立即保存到本机草稿，公开版本不受影响。</p>
    <div className="actions"><button className="button danger" disabled={busy} onClick={onConfirm}>{busy ? '正在删除…' : '确认删除'}</button><button className="button secondary" disabled={busy} onClick={onCancel}>取消删除</button></div>
  </div>
}
