import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<string, string> = {
  PENDING_REVIEW: '待复核',
  PENDING_AUDIT: '待审核',
  IN_AUDIT: '审核中',
  CLOSED: '已销案',
};

const STATUS_STYLES: Record<string, string> = {
  PENDING_REVIEW: 'bg-status-pending-bg text-status-pending-text hover:bg-status-pending-bg',
  PENDING_AUDIT: 'bg-status-audit-bg text-status-audit-text hover:bg-status-audit-bg',
  IN_AUDIT: 'bg-status-reviewing-bg text-status-reviewing-text hover:bg-status-reviewing-bg',
  CLOSED: 'bg-status-closed-bg text-status-closed-text hover:bg-status-closed-bg',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge className={cn(STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground', className)}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

const SEVERITY_LABEL: Record<string, string> = {
  MAJOR: '重大',
  MODERATE: '较大',
  MINOR: '一般',
};

const SEVERITY_STYLES: Record<string, string> = {
  MAJOR: 'bg-status-major-bg text-status-major-text hover:bg-status-major-bg',
  MODERATE: 'bg-status-moderate-bg text-status-moderate-text hover:bg-status-moderate-bg',
  MINOR: 'bg-status-minor-bg text-status-minor-text hover:bg-status-minor-bg',
};

export function SeverityBadge({ severity, className }: { severity: string; className?: string }) {
  return (
    <Badge className={cn(SEVERITY_STYLES[severity] ?? 'bg-muted text-muted-foreground', className)}>
      {SEVERITY_LABEL[severity] ?? severity}
    </Badge>
  );
}
