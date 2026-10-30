import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  Bold,
  BookMarked,
  BookOpen,
  Check,
  CheckSquare,
  ChevronRight,
  Code2,
  ExternalLink,
  GraduationCap,
  Heading2,
  Italic,
  Link2,
  List,
  NotebookPen,
  Pin,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Video,
} from 'lucide-react'
import { useStore } from '../store/AppStore'
import { useUi } from '../components/UiProvider'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Segmented,
} from '../components/ui'
import { BOOKS, COURSES, LEARNING_TIP, type LearningResource } from '../data/learning'
import { markdownToHtml, stripMarkdown } from '../lib/markdown'
import { relativeTime } from '../lib/dates'
import type { Note } from '../types'

type Tab = 'books' | 'courses' | 'notes'

function ResourceCard({ resource, index }: { resource: LearningResource; index: number }) {
  return (
    <Card className="learning-card">
      <div className="learning-card-top">
        <span className="learning-index">{String(index + 1).padStart(2, '0')}</span>
        <Badge tone={resource.level === '教材' ? 'blue' : resource.level === '进阶' ? 'purple' : 'green'}>
          {resource.level}
        </Badge>
        <Badge tone="neutral">{resource.category}</Badge>
      </div>
      <h3>{resource.title}</h3>
      <p className="learning-author">{resource.author}{resource.provider ? ` · ${resource.provider}` : ''}</p>
      <p className="learning-why">{resource.why}</p>
      <div className="learning-takeaway">
        <Sparkles size={13} />
        <span>{resource.takeaway}</span>
      </div>
      <a className="learning-link" href={resource.url} target="_blank" rel="noreferrer">
        {resource.type === 'book' ? '查看书籍资料' : '打开公开课'} <ExternalLink size={13} />
      </a>
    </Card>
  )
}

function NoteEditor({
  note,
  onDeleted,
}: {
  note: Note
  onDeleted: () => void
}) {
  const { updateNote, deleteNote, saveStatus } = useStore()
  const { toast } = useUi()
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [tags, setTags] = useState(note.tags.join('，'))
  const [pinned, setPinned] = useState(note.pinned)
  const [dirty, setDirty] = useState(false)
  const [savedAt, setSavedAt] = useState<number>(note.updatedAt)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const dirtyRef = useRef(false)
  const draftRef = useRef({ title, content, tags, pinned })
  const timer = useRef<number | null>(null)

  useEffect(() => {
    draftRef.current = { title, content, tags, pinned }
    dirtyRef.current = dirty
  }, [title, content, tags, pinned, dirty])

  const persist = () => {
    updateNote(note.id, {
      title: title.trim() || '未命名笔记',
      content,
      tags: tags.split(/[，,、\s]+/).map((tag) => tag.trim()).filter(Boolean),
      pinned,
    })
    setDirty(false)
    dirtyRef.current = false
    setSavedAt(Date.now())
  }

  useEffect(() => {
    if (!dirty) return
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(persist, 800)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, tags, pinned, dirty])

  useEffect(() => {
    return () => {
      if (dirtyRef.current) {
        const draft = draftRef.current
        updateNote(note.id, {
          title: draft.title.trim() || '未命名笔记',
          content: draft.content,
          tags: draft.tags.split(/[，,、\s]+/).map((tag) => tag.trim()).filter(Boolean),
          pinned: draft.pinned,
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        persist()
        toast('笔记已保存到本地文件', 'success')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, tags, pinned])

  const markDirty = () => setDirty(true)

  const insert = (before: string, after = '') => {
    const element = textareaRef.current
    if (!element) return
    const start = element.selectionStart
    const end = element.selectionEnd
    const selected = content.slice(start, end)
    const next = `${content.slice(0, start)}${before}${selected}${after}${content.slice(end)}`
    setContent(next)
    markDirty()
    window.requestAnimationFrame(() => {
      element.focus()
      const cursor = start + before.length + selected.length
      element.setSelectionRange(cursor, cursor)
    })
  }

  const insertLine = (prefix: string) => {
    const element = textareaRef.current
    if (!element) return
    const start = element.selectionStart
    const lineStart = content.lastIndexOf('\n', Math.max(0, start - 1)) + 1
    const next = `${content.slice(0, lineStart)}${prefix}${content.slice(lineStart)}`
    setContent(next)
    markDirty()
    window.requestAnimationFrame(() => {
      element.focus()
      element.setSelectionRange(start + prefix.length, start + prefix.length)
    })
  }

  const remove = () => {
    if (!window.confirm(`删除笔记「${title || '未命名笔记'}」？此操作不可恢复。`)) return
    deleteNote(note.id)
    onDeleted()
    toast('笔记已删除', 'success')
  }

  const preview = useMemo(() => markdownToHtml(content), [content])
  const words = content.replace(/\s/g, '').length

  return (
    <div className="note-editor">
      <div className="note-editor-head">
        <input
          className="note-title-input"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value)
            markDirty()
          }}
          placeholder="笔记标题"
        />
        <div className="note-editor-actions">
          <span className={clsx('note-save-state', dirty && 'is-dirty')}>
            {dirty ? '未保存修改' : savedAt ? <><Check size={12} /> 已存到本地</> : '自动保存'}
          </span>
          <button
            type="button"
            className={clsx('icon-btn', pinned && 'is-pinned')}
            onClick={() => {
              setPinned((value) => !value)
              markDirty()
            }}
            aria-label={pinned ? '取消置顶' : '置顶'}
            title={pinned ? '取消置顶' : '置顶'}
          >
            <Pin size={15} fill={pinned ? 'currentColor' : 'none'} />
          </button>
          <button type="button" className="icon-btn danger" onClick={remove} aria-label="删除笔记" title="删除笔记">
            <Trash2 size={15} />
          </button>
          <Button size="sm" onClick={persist}>保存</Button>
        </div>
      </div>

      <div className="note-meta-row">
        <Input
          value={tags}
          onChange={(event) => {
            setTags(event.target.value)
            markDirty()
          }}
          placeholder="标签，用逗号分隔：交易系统，读书笔记"
        />
        <span>{words} 字</span>
        <span>本地文件存储 · {saveStatus === 'error' ? '保存异常' : '自动保存'}</span>
      </div>

      <div className="note-toolbar">
        <button type="button" onClick={() => insertLine('## ')} title="二级标题"><Heading2 size={15} /></button>
        <button type="button" onClick={() => insert('**', '**')} title="加粗"><Bold size={15} /></button>
        <button type="button" onClick={() => insert('*', '*')} title="斜体"><Italic size={15} /></button>
        <button type="button" onClick={() => insertLine('- ')} title="无序列表"><List size={15} /></button>
        <button type="button" onClick={() => insertLine('- [ ] ')} title="待办清单"><CheckSquare size={15} /></button>
        <button type="button" onClick={() => insert('`', '`')} title="行内代码"><Code2 size={15} /></button>
        <button type="button" onClick={() => insert('[', '](https://)')} title="链接"><Link2 size={15} /></button>
        <span />
        <span className="note-markdown-hint">支持 Markdown · Ctrl/⌘ + S 保存</span>
      </div>

      <div className="note-editor-split">
        <textarea
          ref={textareaRef}
          className="note-textarea"
          value={content}
          onChange={(event) => {
            setContent(event.target.value)
            markDirty()
          }}
          placeholder={'# 今天学到什么？\n\n- 关键概念\n- 我的理解\n- 如何用到交易里'}
          spellCheck={false}
        />
        <div className="note-preview">
          {content.trim() ? (
            <div className="md-preview" dangerouslySetInnerHTML={{ __html: preview }} />
          ) : (
            <div className="note-preview-empty">预览会显示在这里</div>
          )}
        </div>
      </div>
    </div>
  )
}

function NotesWorkspace() {
  const { state, addNote } = useStore()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const notes = useMemo(() => {
    const text = query.trim().toLowerCase()
    return [...state.notes]
      .filter((note) => !text || note.title.toLowerCase().includes(text) || note.content.toLowerCase().includes(text) || note.tags.some((tag) => tag.toLowerCase().includes(text)))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)
  }, [state.notes, query])

  useEffect(() => {
    if (state.notes.length === 0) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !state.notes.some((note) => note.id === selectedId)) {
      setSelectedId(notes[0]?.id ?? state.notes[0].id)
    }
  }, [state.notes, notes, selectedId])

  const selected = state.notes.find((note) => note.id === selectedId) ?? null

  const create = () => {
    const id = addNote({ title: '未命名笔记', content: '', tags: [], pinned: false })
    setSelectedId(id)
    setQuery('')
  }

  return (
    <div className="notes-workspace">
      <aside className="notes-sidebar">
        <div className="notes-sidebar-head">
          <div className="search-input">
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索笔记" />
          </div>
          <Button size="sm" icon={<Plus size={14} />} onClick={create}>新建</Button>
        </div>
        {notes.length === 0 ? (
          <div className="notes-side-empty">{state.notes.length === 0 ? '还没有笔记，写下第一条。' : '没有匹配的笔记。'}</div>
        ) : (
          <div className="notes-list">
            {notes.map((note) => (
              <button
                type="button"
                key={note.id}
                className={clsx('note-list-item', note.id === selectedId && 'is-active')}
                onClick={() => setSelectedId(note.id)}
              >
                <span className="note-list-title">
                  {note.pinned ? <Pin size={11} fill="currentColor" /> : null}
                  {note.title || '未命名笔记'}
                </span>
                <span className="note-list-snippet">{stripMarkdown(note.content) || '空白笔记'}</span>
                <span className="note-list-foot">
                  <small>{relativeTime(note.updatedAt)}</small>
                  {note.tags.slice(0, 2).map((tag) => <em key={tag}>{tag}</em>)}
                </span>
              </button>
            ))}
          </div>
        )}
      </aside>
      <div className="notes-main">
        {selected ? (
          <NoteEditor key={selected.id} note={selected} onDeleted={() => setSelectedId(null)} />
        ) : (
          <EmptyState
            icon={<NotebookPen size={30} />}
            title="把学到的，写下来"
            description="技术知识、读书摘录、交易检查清单，都可以放在这里。支持 Markdown 与实时预览。"
            action={<Button onClick={create} icon={<Plus size={15} />}>新建笔记</Button>}
          />
        )}
      </div>
    </div>
  )
}

export function Learning() {
  const { state } = useStore()
  const [tab, setTab] = useState<Tab>('books')
  const [category, setCategory] = useState('全部')

  const categories = useMemo(() => ['全部', ...new Set(BOOKS.map((book) => book.category))], [])
  const books = category === '全部' ? BOOKS : BOOKS.filter((book) => book.category === category)

  return (
    <div className="page learning-page">
      <PageHeader
        eyebrow="工具箱 / 学习笔记"
        title="把学到的东西，变成自己的规则"
        description="经典教材、公开课和你的 Markdown 笔记。学习不是收藏，是把它写进下一次决策。"
        actions={
          <Button icon={<NotebookPen size={15} />} onClick={() => setTab('notes')}>
            我的笔记 · {state.notes.length}
          </Button>
        }
      />

      <div className="learning-hero">
        <div>
          <span className="panel-kicker">学习路径</span>
          <h2>先建立框架，再练习判断</h2>
          <p>{LEARNING_TIP}</p>
        </div>
        <div className="learning-stats">
          <div><strong>{BOOKS.length}</strong><span>经典书目</span></div>
          <div><strong>{COURSES.length}</strong><span>公开课</span></div>
          <div><strong>{state.notes.length}</strong><span>我的笔记</span></div>
        </div>
      </div>

      <div className="learning-tabs">
        <Segmented
          value={tab}
          options={[
            { value: 'books', label: '推荐书单' },
            { value: 'courses', label: '公开课' },
            { value: 'notes', label: '我的笔记' },
          ]}
          onChange={setTab}
        />
        {tab === 'books' ? (
          <div className="learning-categories">
            {categories.map((item) => (
              <button
                type="button"
                key={item}
                className={clsx('chip chip-sm', category === item && 'is-active')}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {tab === 'books' ? (
        <div className="learning-grid">
          {books.map((book, index) => <ResourceCard key={book.id} resource={book} index={index} />)}
        </div>
      ) : null}

      {tab === 'courses' ? (
        <div className="learning-grid">
          {COURSES.map((course, index) => <ResourceCard key={course.id} resource={course} index={index} />)}
        </div>
      ) : null}

      {tab === 'notes' ? <NotesWorkspace /> : null}

      <div className="learning-footer">
        <BookMarked size={14} />
        <span>书目与课程为学习路径建议，不构成投资建议。链接可能随平台调整而变化。</span>
        <a href="https://search.bilibili.com/all?keyword=%E9%87%91%E8%9E%8D%20%E6%8A%95%E8%B5%84%20%E5%85%AC%E5%BC%80%E8%AF%BE" target="_blank" rel="noreferrer">
          B站金融公开课 <ChevronRight size={12} />
        </a>
      </div>
    </div>
  )
}
