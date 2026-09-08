import { useEffect } from 'react'
import { importJsonFromText } from './file-actions'

function isJsonFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.json') || file.type === 'application/json'
}

/**
 * 窗口级拖入 .json：一律按未命名导入（不走 Electron 路径白名单）。
 * 侧栏拖算子到画布的 dataTransfer.types 不含 Files，不会误触发。
 */
export function useFileDrop(): void {
  useEffect(() => {
    const onDragOver = (event: DragEvent): void => {
      if (!event.dataTransfer?.types.includes('Files')) {
        return
      }
      event.preventDefault()
    }

    const onDrop = (event: DragEvent): void => {
      if (!event.dataTransfer?.types.includes('Files')) {
        return
      }
      event.preventDefault()
      const file = event.dataTransfer.files.item(0)
      if (!file || !isJsonFile(file)) {
        return
      }
      void file.text().then((text) => importJsonFromText(text, file.name))
    }

    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [])
}
