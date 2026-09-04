'use client'

import { PlusIcon } from 'lucide-react'
import { useActionState, useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { createProject, type ActionState } from './actions'

export function ProjectForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createProject, { ok: false })
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset()
      toast.success('Project created')
    }
  }, [state])

  return (
    <Card>
      <CardHeader>
        <CardTitle>New project</CardTitle>
        <CardDescription>Projects belong to the active organization.</CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={action} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="project-name">Name</Label>
            <Input id="project-name" name="name" required minLength={2} maxLength={80} placeholder="Website redesign" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea id="project-description" name="description" maxLength={500} placeholder="Optional" rows={3} />
          </div>
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner /> : <PlusIcon />}
              Create project
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
