export const API_ENDPOINTS = {

  ADMINS: {
    BASE: '/admins',

    BY_ID: (id: number) =>
      `/admins/${id}`,

    DETAILS: (id: number) =>
      `/admins/${id}/details`,

    STATUS: (id: number) =>
      `/admins/${id}/status`
  },

  TEACHERS: {
    BASE: '/teachers',

    BY_ID: (id: number) =>
      `/teachers/${id}`,

    STATUS: (id: number) =>
      `/teachers/${id}/status`
  },

  STUDENTS: {
    BASE: '/students',

    BY_ID: (id: number) =>
      `/students/${id}`,

    STATUS: (id: number) =>
      `/students/${id}/status`
  },

  FEE_STRUCTURES: {
    BASE: '/fee-structures',

    BY_ID: (id: number) =>
      `/fee-structures/${id}`,

    STATUS: (id: number) =>
      `/fee-structures/${id}/status`
  },

  STUDENT_FEES: {
    BASE: '/student-fees',

    BY_ID: (id: number) =>
      `/student-fees/${id}`,

    BY_CLASS: '/student-fees/class',

    MY: '/student-fees/my',

    MY_RECEIPTS: (studentFeeId: number) =>
      `/student-fees/my/${studentFeeId}/receipts`
  },

FEE_PAYMENTS: {
  BASE: '/fee-payments',

  BY_ID: (paymentId: number) =>
    `/fee-payments/${paymentId}`,

  BY_STUDENT_FEE: (studentFeeId: number) =>
    `/fee-payments/student-fee/${studentFeeId}`,

  MY: (studentFeeId: number) =>
    `/fee-payments/my/${studentFeeId}`
},

  RECEIPT_SETTINGS: {
    BASE: '/receipt-settings',

    MEDIA: {
      LOGO: '/receipt-settings/media/logo',
      SIGNATURE: '/receipt-settings/media/signature',
      STAMP: '/receipt-settings/media/stamp',
      BADGE: '/receipt-settings/media/badge'
    }
  },

  FEE_RECEIPTS: {

    MY_BY_ID: (receiptId: number) =>
      `/student/fee-receipts/${receiptId}`,

    MY_PDF: (receiptId: number) =>
      `/student/fee-receipts/${receiptId}/pdf`
  },

  PROFILE: {
  BASE: '/profile',
  CHANGE_PASSWORD: '/profile/password'
},

  ADVERTISEMENTS: {
    BASE: '/advertisements',

    SETTINGS: '/advertisements/settings',

    FEED: '/advertisements/feed',

    BY_ID: (id: number) =>
      `/advertisements/${id}`,

    PUBLISH: (id: number) =>
      `/advertisements/${id}/publish`,

    PAUSE: (id: number) =>
      `/advertisements/${id}/pause`,

    RESUME: (id: number) =>
      `/advertisements/${id}/resume`,

    ARCHIVE: (id: number) =>
      `/advertisements/${id}/archive`,

    MEDIA: (id: number) =>
      `/advertisements/${id}/media`,

    MEDIA_BY_ID: (id: number, mediaId: number) =>
      `/advertisements/${id}/media/${mediaId}`,

    MEDIA_CONTENT: (mediaId: number) =>
      `/advertisements/media/${mediaId}`
  },
};
