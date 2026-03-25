/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as newOrderApproval } from './new-order-approval.tsx'
import { template as orderRejected } from './order-rejected.tsx'
import { template as orderApproved } from './order-approved.tsx'
import { template as orderDelivered } from './order-delivered.tsx'
import { template as helpdeskOrder } from './helpdesk-order.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'new-order-approval': newOrderApproval,
  'order-rejected': orderRejected,
  'order-approved': orderApproved,
  'order-delivered': orderDelivered,
  'helpdesk-order': helpdeskOrder,
}
