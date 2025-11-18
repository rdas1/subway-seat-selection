import { useState } from 'react'
import './StudyBuilder.css'

export default function StudyBuilder() {
  const [email, setEmail] = useState<string>('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Handle form submission
    console.log('Email:', email)
  }

  return (
    <div className="study-builder">
      <div className="study-builder-container">
        <h1>Study Builder</h1>
        <form onSubmit={handleSubmit} className="study-builder-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address"
              required
            />
          </div>
          <button type="submit" className="submit-button">
            Create Study
          </button>
        </form>
      </div>
    </div>
  )
}

