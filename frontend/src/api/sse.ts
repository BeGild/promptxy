import { SSERequestEvent, SSEConnectionStatus } from "@/types";

export class SSEClient {
  private eventSource: EventSource | null = null;
  private url: string;
  private onEvent: (event: SSERequestEvent) => void;
  private onStatusChange: (status: SSEConnectionStatus) => void;
  private reconnectDelay: number = 3000;
  private maxReconnectDelay: number = 30000;
  private isManuallyClosed: boolean = false;

  constructor(
    url: string,
    onEvent: (event: SSERequestEvent) => void,
    onStatusChange: (status: SSEConnectionStatus) => void
  ) {
    this.url = url;
    this.onEvent = onEvent;
    this.onStatusChange = onStatusChange;
  }

  connect(): void {
    if (this.eventSource) {
      return;
    }

    this.isManuallyClosed = false;
    this.updateStatus({ connected: false, lastEvent: null, error: null });

    try {
      this.eventSource = new EventSource(this.url);

      this.eventSource.onopen = () => {
        this.updateStatus({ connected: true, lastEvent: Date.now(), error: null });
        this.reconnectDelay = 3000; // 重置重连延迟
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.onEvent(data);
          this.updateStatus({ connected: true, lastEvent: Date.now(), error: null });
        } catch (e) {
          console.error("Failed to parse SSE event:", e);
        }
      };

      this.eventSource.addEventListener("request", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          this.onEvent(data);
          this.updateStatus({ connected: true, lastEvent: Date.now(), error: null });
        } catch (e) {
          console.error("Failed to parse request event:", e);
        }
      });

      this.eventSource.addEventListener("connected", () => {
        this.updateStatus({ connected: true, lastEvent: Date.now(), error: null });
      });

      this.eventSource.onerror = () => {
        this.eventSource?.close();
        this.eventSource = null;

        if (this.isManuallyClosed) {
          this.updateStatus({ connected: false, lastEvent: null, error: "连接已关闭" });
          return;
        }

        // 自动重连
        this.updateStatus({
          connected: false,
          lastEvent: null,
          error: `连接断开，${this.reconnectDelay / 1000}秒后重试...`,
        });

        setTimeout(() => {
          if (!this.isManuallyClosed) {
            this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
            this.connect();
          }
        }, this.reconnectDelay);
      };
    } catch (error: any) {
      this.updateStatus({ connected: false, lastEvent: null, error: error?.message || "连接失败" });
    }
  }

  disconnect(): void {
    this.isManuallyClosed = true;
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.updateStatus({ connected: false, lastEvent: null, error: "已断开连接" });
  }

  private updateStatus(status: SSEConnectionStatus): void {
    this.onStatusChange(status);
  }

  isConnected(): boolean {
    return this.eventSource !== null && this.eventSource.readyState === EventSource.OPEN;
  }
}
