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
import { template as onboardingHrNewApplication } from './onboarding-hr-new-application.tsx'
import { template as onboardingOwnerTaskBatch } from './onboarding-owner-task-batch.tsx'
import { template as onboardingReminder } from './onboarding-reminder.tsx'
import { template as onboardingCompleted } from './onboarding-completed.tsx'
import { template as onboardingCancelled } from './onboarding-cancelled.tsx'
import { template as offboardingHrNew } from './offboarding-hr-new.tsx'
import { template as offboardingOwnerTaskBatch } from './offboarding-owner-task-batch.tsx'
import { template as offboardingReminder } from './offboarding-reminder.tsx'
import { template as offboardingCompleted } from './offboarding-completed.tsx'
import { template as offboardingCancelled } from './offboarding-cancelled.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'new-order-approval': newOrderApproval,
  'order-rejected': orderRejected,
  'order-approved': orderApproved,
  'order-delivered': orderDelivered,
  'helpdesk-order': helpdeskOrder,
  'onboarding-hr-new-application': onboardingHrNewApplication,
  'onboarding-owner-task-batch': onboardingOwnerTaskBatch,
  'onboarding-reminder': onboardingReminder,
  'onboarding-completed': onboardingCompleted,
  'onboarding-cancelled': onboardingCancelled,
  'offboarding-hr-new': offboardingHrNew,
  'offboarding-owner-task-batch': offboardingOwnerTaskBatch,
  'offboarding-reminder': offboardingReminder,
  'offboarding-completed': offboardingCompleted,
  'offboarding-cancelled': offboardingCancelled,
}
