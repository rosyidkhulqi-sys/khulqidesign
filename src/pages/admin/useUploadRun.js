// Runs an upload as runPool does and keeps count of the files that are
// through, for UploadProgress.
import { useState } from "react";
import { runPool } from "../../lib/uploadPool";

// [run, pool]: pool(queue, atOnce, worker) runs the upload as runPool does and
// keeps count of the files that are through
function useUploadRun() {
  const [run, setRun] = useState(null);
  const pool = async (queue, atOnce, worker) => {
    setRun({ total: queue.length, through: 0 });
    try {
      await runPool(queue, atOnce, async (item) => {
        try {
          await worker(item);
        } finally {
          setRun((r) => r && { ...r, through: r.through + 1 });
        }
      });
    } finally {
      setRun(null);
    }
  };
  return [run, pool];
}

export default useUploadRun;
