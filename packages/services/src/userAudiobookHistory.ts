import type { ISuccessResponse } from "./models";
import request from "./request";

export const reportAudiobookProgress = (data: {
  userId: number | string;
  trackId: number | string;
  progress: number;
}) => {
  return request.post<any, ISuccessResponse<any>>("/user-audiobook-histories", data);
};
