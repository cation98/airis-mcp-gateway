# SC Command Benchmark Plan

**Objective**: Measure actual performance difference between using SC commands vs native Claude Code interactions

**Hypothesis**: SC commands add value through systematic methodology, but we need evidence to prove it

---

## Measurement Criteria

### Quantitative Metrics

1. **Token Consumption**
   - Input tokens (prompt)
   - Output tokens (response)
   - Total tokens consumed
   - Measurement: Built-in token counter

2. **Time to Completion**
   - Wall clock time from prompt → final output
   - Measurement: Manual timing with timestamps

3. **Interaction Count**
   - Number of back-and-forth messages needed
   - Measurement: Manual count

### Qualitative Metrics

1. **Output Quality** (1-5 scale)
   - Correctness: Does it work?
   - Completeness: Does it cover all requirements?
   - Code Quality: Is it well-structured?
   - Documentation: Is it well-documented?

2. **User Experience** (1-5 scale)
   - Clarity: Was the process clear?
   - Efficiency: Was it efficient?
   - Guidance: Did it provide good guidance?

---

## Test Scenarios

### Priority 1: Top 5 Commands (Critical Path)

#### 1. `/sc:implement` - Feature Implementation

**Test Case**: "Create a simple user authentication form with email/password validation"

**Test A (No Command)**:
```
Prompt: "Create a React component for user authentication with email and password fields. Include validation for email format and password strength (min 8 chars, 1 uppercase, 1 number)."

Measure:
- Tokens consumed
- Time to complete
- Number of interactions
- Quality (correctness, completeness, code quality, docs)
```

**Test B (With Command)**:
```
Prompt: "/sc:implement user authentication form --framework react --with-validation"

Measure:
- Tokens consumed
- Time to complete
- Number of interactions
- Quality (correctness, completeness, code quality, docs)
```

**Success Criteria**: Command version should show measurable improvement in at least 2/4 quantitative metrics

---

#### 2. `/sc:improve` - Code Quality Improvement

**Test Case**: "Improve this legacy code snippet"

**Setup**: Provide messy code snippet
```javascript
function calc(a,b,c){
  var x=a+b
  if(c){x=x*2}
  return x
}
```

**Test A (No Command)**:
```
Prompt: "Improve this code for better readability and maintainability"

Measure: Same metrics as above
```

**Test B (With Command)**:
```
Prompt: "/sc:improve [code] --type quality --safe"

Measure: Same metrics as above
```

---

#### 3. `/sc:analyze` - Code Analysis

**Test Case**: "Analyze this component for quality issues"

**Setup**: Provide React component with issues
```typescript
export const UserList = ({users}) => {
  const [data, setData] = useState([])
  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(setData)
  })
  return <div>{data.map(u => <div>{u.name}</div>)}</div>
}
```

**Test A (No Command)**:
```
Prompt: "Analyze this React component for quality, security, and performance issues"
```

**Test B (With Command)**:
```
Prompt: "/sc:analyze [code] --focus quality,security,performance"
```

---

#### 4. `/sc:troubleshoot` - Bug Fixing

**Test Case**: "Fix this error"

**Setup**: Provide error message
```
TypeError: Cannot read property 'map' of undefined
  at UserList.render (UserList.tsx:12)
```

**Test A (No Command)**:
```
Prompt: "This error is occurring: [error]. Here's the code: [code]. How do I fix it?"
```

**Test B (With Command)**:
```
Prompt: "/sc:troubleshoot [error] --type bug --trace"
```

---

#### 5. `/sc:explain` - Code Explanation

**Test Case**: "Explain how this works"

**Setup**: Provide complex code
```typescript
const useDebouncedValue = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}
```

**Test A (No Command)**:
```
Prompt: "Explain how this custom React hook works"
```

**Test B (With Command)**:
```
Prompt: "/sc:explain [code] --level intermediate --format examples"
```

---

### Priority 2: Workflow Commands

#### 6. `/sc:document` - Documentation Generation

**Test Case**: "Generate API documentation for this function"

**Setup**: Provide function without docs
```typescript
function processPayment(amount: number, currency: string, method: PaymentMethod): Promise<PaymentResult> {
  // implementation
}
```

**Test A vs B**: Same pattern as above

---

#### 7. `/sc:design` - System Design

**Test Case**: "Design a notification system"

**Test A (No Command)**:
```
Prompt: "Design a notification system for a web application that supports email, SMS, and push notifications"
```

**Test B (With Command)**:
```
Prompt: "/sc:design notification-system --type architecture --format diagram"
```

---

#### 8. `/sc:cleanup` - Code Cleanup

**Test Case**: "Clean up this messy codebase"

**Setup**: Provide file with dead code, unused imports
```typescript
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import lodash from 'lodash'
import moment from 'moment'

export const MyComponent = () => {
  const [count, setCount] = useState(0)
  const unusedFunction = () => console.log('never called')
  return <div>{count}</div>
}
```

**Test A vs B**: Same pattern

---

### Priority 3: Specialized Commands

#### 9. `/sc:spec-panel` - Specification Review

**Test Case**: "Review this API specification"

**Setup**: Provide incomplete API spec
```yaml
POST /api/users
Request: { name, email }
Response: { id, name, email }
```

**Test A (No Command)**:
```
Prompt: "Review this API specification and suggest improvements"
```

**Test B (With Command)**:
```
Prompt: "/sc:spec-panel [spec] --mode critique --focus requirements,architecture"
```

---

#### 10. `/sc:estimate` - Development Estimation

**Test Case**: "Estimate time to build this feature"

**Test A (No Command)**:
```
Prompt: "How long would it take to build a user dashboard with analytics charts, user management, and export functionality?"
```

**Test B (With Command)**:
```
Prompt: "/sc:estimate 'user dashboard with analytics, user management, export' --type time --unit days --breakdown"
```

---

#### 11. `/sc:brainstorm` - Requirements Discovery

**Test Case**: "Help me brainstorm a new feature"

**Test A (No Command)**:
```
Prompt: "I want to add a collaborative editing feature to my app. Help me think through the requirements."
```

**Test B (With Command)**:
```
Prompt: "/sc:brainstorm 'collaborative editing feature' --strategy systematic --depth normal"
```

---

### Priority 4: Session Management (Serena MCP Required)

#### 12. `/sc:load` / `/sc:save` / `/sc:reflect`

**Test Case**: Session continuity across multiple sessions

**Test A (No Command)**:
```
Session 1: "Start working on authentication system"
Session 2: "Continue working on authentication system from where we left off"
```

**Test B (With Command)**:
```
Session 1: "/sc:save --type session"
Session 2: "/sc:load"
```

---

## Benchmark Execution Protocol

### For Each Test Scenario

1. **Prepare**
   - Clear chat history
   - Note starting timestamp
   - Prepare test materials

2. **Execute Test A (No Command)**
   - Send prompt
   - Note timestamp
   - Interact naturally until completion
   - Note completion timestamp
   - Record token usage (check /context or API response)
   - Save full conversation to file

3. **Execute Test B (With Command)**
   - Clear chat history
   - Send prompt with command
   - Note timestamp
   - Interact naturally until completion
   - Note completion timestamp
   - Record token usage
   - Save full conversation to file

4. **Evaluate**
   - Quality scoring (1-5 scale)
   - Calculate time difference
   - Calculate token difference
   - Calculate interaction count difference
   - Document observations

5. **Document Evidence**
   - Screenshot of both conversations
   - Token usage data
   - Timing data
   - Quality scores with justification
   - Save to `docs/benchmarks/evidence/[command-name]/`

---

## Data Collection Template

```markdown
# Benchmark: [Command Name]

## Test Case
[Description]

## Test A: No Command

**Prompt**:
```
[exact prompt used]
```

**Results**:
- Tokens: [input] + [output] = [total]
- Time: [XX] seconds
- Interactions: [N] messages
- Quality Scores:
  - Correctness: [1-5]
  - Completeness: [1-5]
  - Code Quality: [1-5]
  - Documentation: [1-5]
  - **Total**: [/20]

**Evidence**:
- Conversation: `evidence/[command]/test-a-conversation.md`
- Screenshot: `evidence/[command]/test-a-screenshot.png`

## Test B: With Command

**Prompt**:
```
[exact prompt used]
```

**Results**:
- Tokens: [input] + [output] = [total]
- Time: [XX] seconds
- Interactions: [N] messages
- Quality Scores:
  - Correctness: [1-5]
  - Completeness: [1-5]
  - Code Quality: [1-5]
  - Documentation: [1-5]
  - **Total**: [/20]

**Evidence**:
- Conversation: `evidence/[command]/test-b-conversation.md`
- Screenshot: `evidence/[command]/test-b-screenshot.png`

## Comparison

| Metric | No Command | With Command | Difference | Winner |
|---|---|---|---|---|
| Tokens | [N] | [N] | [+/-X%] | [A/B] |
| Time | [N]s | [N]s | [+/-X%] | [A/B] |
| Interactions | [N] | [N] | [+/-X] | [A/B] |
| Quality | [N/20] | [N/20] | [+/-X] | [A/B] |

## Verdict

**Command Value**: [HIGH / MEDIUM / LOW / NONE]

**Reasoning**: [Detailed explanation based on data]

**Recommendation**: [KEEP / REMOVE / MODIFY]
```

---

## Success Criteria for "KEEP" Recommendation

A command should be kept if it shows **at least ONE** of:

1. **Token Efficiency**: ≥20% reduction in total tokens
2. **Time Efficiency**: ≥30% reduction in time to completion
3. **Quality Improvement**: ≥2 point improvement in total quality score (out of 20)
4. **Interaction Reduction**: ≥50% reduction in back-and-forth messages

If a command shows **NONE** of these improvements, it should be marked for **REMOVAL** or **MODIFICATION**.

---

## Execution Order

### Week 1: Priority 1 (Top 5)
- Day 1: `/sc:implement`, `/sc:improve`
- Day 2: `/sc:analyze`, `/sc:troubleshoot`
- Day 3: `/sc:explain`

### Week 2: Priority 2 (Workflow)
- Day 1: `/sc:document`, `/sc:design`
- Day 2: `/sc:cleanup`

### Week 3: Priority 3 (Specialized)
- Day 1: `/sc:spec-panel`
- Day 2: `/sc:estimate`, `/sc:brainstorm`

### Week 4: Priority 4 (Session Management)
- Day 1: `/sc:load`, `/sc:save`, `/sc:reflect`

---

## Deliverables

1. **Benchmark Results**: `docs/benchmarks/results/[command-name].md` (12 files)
2. **Evidence Archive**: `docs/benchmarks/evidence/[command-name]/` (screenshots, conversations)
3. **Summary Report**: `docs/benchmarks/BENCHMARK_RESULTS_SUMMARY.md`
4. **Updated Recommendations**: `docs/SC_COMMAND_FINAL_RECOMMENDATIONS.md` (based on evidence)

---

**Next Action**: Start with `/sc:implement` benchmark (Priority 1, #1)
