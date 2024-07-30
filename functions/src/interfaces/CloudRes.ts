export interface CloudRes {
    error: boolean
    msg: string
    data: any
}

export const res_ok: CloudRes = {
  error: false,
  msg: "OK",
  data: null,
};

export const unauthorized: CloudRes = {
  error: true,
  msg: "Unauthorized",
  data: null,
};

export const bad_request: CloudRes = {
  error: true,
  msg: "Bad Request",
  data: null,
};

export const not_found: CloudRes = {
  error: true,
  msg: "Not found",
  data: null,
};
