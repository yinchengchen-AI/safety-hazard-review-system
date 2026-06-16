import { render, screen } from '@testing-library/react';
import { StatusBadge, SeverityBadge } from '@/components/ui/status-badge';

describe('StatusBadge', () => {
  it('renders pending review label', () => {
    render(<StatusBadge status="PENDING_REVIEW" />);
    expect(screen.getByText('待复核')).toBeInTheDocument();
  });

  it('renders fallback for unknown status', () => {
    render(<StatusBadge status="UNKNOWN" />);
    expect(screen.getByText('UNKNOWN')).toBeInTheDocument();
  });
});

describe('SeverityBadge', () => {
  it('renders major label', () => {
    render(<SeverityBadge severity="MAJOR" />);
    expect(screen.getByText('重大')).toBeInTheDocument();
  });
});
