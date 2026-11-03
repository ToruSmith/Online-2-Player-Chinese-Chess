import { Link } from '../lib/router';
import { Icon } from './Icon';

export function PageHeader({ title, backTo = '/' }: { title: string; backTo?: string }) {
  return (
    <header className="page__header">
      <Link to={backTo} className="icon-button" aria-label="返回">
        <Icon name="back" />
      </Link>
      <h1 className="page__title">{title}</h1>
    </header>
  );
}
