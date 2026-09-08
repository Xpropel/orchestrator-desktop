import { Component, type ErrorInfo, type JSX, type ReactNode } from 'react'

export class ErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  public state = { hasError: false }

  public static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack)
  }

  public render(): JSX.Element {
    if (this.state.hasError) {
      return <>{this.props.fallback}</>
    }
    return <>{this.props.children}</>
  }
}
