import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  label?: string
}
interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid h-full min-h-[240px] place-items-center bg-bg p-6">
          <div className="panel max-w-md p-6 text-center">
            <h2 className="text-lg font-semibold">{this.props.label ?? 'Something went wrong'}</h2>
            <p className="mt-2 text-sm text-muted">{this.state.error.message}</p>
            <button
              type="button"
              className="btn-primary mt-4"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
