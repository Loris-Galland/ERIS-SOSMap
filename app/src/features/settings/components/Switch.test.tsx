/*
 * Vitest unit tests for the Switch component.
 * Covers rendering (active/inactive CSS classes, thumb position) and interaction (onClick calls).
 * Connects to features/settings/components/Switch.tsx and uses @testing-library/react + userEvent.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Switch from './Switch';

// ─── Rendering ───

describe('Switch — rendering', () => {
  it('renders without crashing', () => {
    render(<Switch active={false} onClick={vi.fn()} />);
    expect(document.querySelector('[class*="rounded-full"]')).toBeInTheDocument();
  });

  it('applies active CSS class when active=true', () => {
    const { container } = render(<Switch active={true} onClick={vi.fn()} />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('bg-eris-primary');
  });

  it('applies inactive CSS class when active=false', () => {
    const { container } = render(<Switch active={false} onClick={vi.fn()} />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('bg-gray-700');
  });

  it('positions the thumb on the right when active', () => {
    const { container } = render(<Switch active={true} onClick={vi.fn()} />);
    const thumb = (container.firstChild as HTMLElement).firstChild as HTMLElement;
    expect(thumb.className).toContain('left-[22px]');
  });

  it('positions the thumb on the left when inactive', () => {
    const { container } = render(<Switch active={false} onClick={vi.fn()} />);
    const thumb = (container.firstChild as HTMLElement).firstChild as HTMLElement;
    expect(thumb.className).toContain('left-[3px]');
  });
});

// ─── Interaction ───

describe('Switch — interaction', () => {
  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    const { container } = render(<Switch active={false} onClick={onClick} />);
    const user = userEvent.setup();

    await user.click(container.firstChild as HTMLElement);

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('calls onClick multiple times for multiple clicks', async () => {
    const onClick = vi.fn();
    const { container } = render(<Switch active={false} onClick={onClick} />);
    const user = userEvent.setup();

    await user.click(container.firstChild as HTMLElement);
    await user.click(container.firstChild as HTMLElement);
    await user.click(container.firstChild as HTMLElement);

    expect(onClick).toHaveBeenCalledTimes(3);
  });
});
