import { SegmentStatusCallback_Notificacion } from "../01_batch_creation/interfaces";

export interface SegmentStatusBuffer {
  [idocID: string]: SegmentStatusBufferItem;
}

export interface SegmentStatusBufferItem
  extends SegmentStatusCallback_Notificacion {
  createdAt: number;
  lastUpdate?: number;
}
