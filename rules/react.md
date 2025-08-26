# React Development Rules

- Last Updated: 2025-01-26
- Description: React development best practices and conventions
- Version: 1.0

## Component Design

### Functional Components
- Always prefer functional components over class components
- Use hooks for state management and side effects
- Keep components small and focused on a single responsibility

### Component Structure
```jsx
// Good: Clear, focused component
function UserProfile({ user, onEdit }) {
  const [isEditing, setIsEditing] = useState(false);
  
  return (
    <div className="user-profile">
      {isEditing ? (
        <EditForm user={user} onSave={onEdit} />
      ) : (
        <DisplayView user={user} onEdit={() => setIsEditing(true)} />
      )}
    </div>
  );
}
```

## State Management

### useState Hook
- Use descriptive state variable names
- Group related state into objects when appropriate
- Initialize state with the correct type

```jsx
// Good: Descriptive and properly typed
const [userProfile, setUserProfile] = useState({
  name: '',
  email: '',
  preferences: {}
});

// Bad: Vague naming
const [data, setData] = useState({});
```

### useEffect Hook
- Always include dependency arrays
- Clean up subscriptions and timers
- Separate concerns into different useEffect hooks

```jsx
// Good: Proper cleanup and dependencies
useEffect(() => {
  const subscription = api.subscribe(userId, handleUpdate);
  
  return () => {
    subscription.unsubscribe();
  };
}, [userId]);
```

## Performance Optimization

### Memoization
- Use React.memo for expensive components
- Use useMemo for expensive calculations
- Use useCallback for stable function references

```jsx
// Good: Memoized expensive component
const ExpensiveComponent = React.memo(({ data, onUpdate }) => {
  const processedData = useMemo(() => {
    return data.map(item => expensiveTransform(item));
  }, [data]);
  
  const handleClick = useCallback((id) => {
    onUpdate(id);
  }, [onUpdate]);
  
  return <div>{/* render processedData */}</div>;
});
```

### List Rendering
- Always provide stable keys for list items
- Avoid using array indices as keys when list can change
- Consider virtualization for large lists

```jsx
// Good: Stable, unique keys
{users.map(user => (
  <UserCard key={user.id} user={user} />
))}

// Bad: Index as key for dynamic list
{users.map((user, index) => (
  <UserCard key={index} user={user} />
))}
```

## Error Handling

### Error Boundaries
- Implement error boundaries for component trees
- Provide fallback UI for error states
- Log errors for debugging

```jsx
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    
    return this.props.children;
  }
}
```

## Testing

### Component Testing
- Test component behavior, not implementation details
- Use React Testing Library for user-centric tests
- Mock external dependencies

```jsx
// Good: Testing user interactions
test('should update user name when form is submitted', async () => {
  const mockOnUpdate = jest.fn();
  render(<UserForm user={mockUser} onUpdate={mockOnUpdate} />);
  
  const nameInput = screen.getByLabelText(/name/i);
  const submitButton = screen.getByRole('button', { name: /save/i });
  
  await user.type(nameInput, 'New Name');
  await user.click(submitButton);
  
  expect(mockOnUpdate).toHaveBeenCalledWith({
    ...mockUser,
    name: 'New Name'
  });
});
```

## Accessibility

### Semantic HTML
- Use proper HTML elements for their intended purpose
- Provide alt text for images
- Use proper heading hierarchy

### ARIA Attributes
- Add ARIA labels for screen readers
- Use proper roles for custom components
- Ensure keyboard navigation works

```jsx
// Good: Accessible button component
function IconButton({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="icon-button"
    >
      <Icon name={icon} aria-hidden="true" />
    </button>
  );
}
```

## Code Organization

### File Structure
```
src/
├── components/
│   ├── common/
│   ├── forms/
│   └── layout/
├── hooks/
├── utils/
├── services/
└── types/
```

### Import Organization
```jsx
// 1. React and third-party imports
import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';

// 2. Internal imports (absolute paths)
import { Button } from '@/components/common';
import { useAuth } from '@/hooks';

// 3. Relative imports
import './UserProfile.css';
```