import { useState, useEffect, useMemo } from 'react'
import { Offcanvas, Form, InputGroup, Button } from 'react-bootstrap'
import { useHelp } from '../context/HelpContext.jsx'
import { ARTICLES } from '../help/articles.js'

export default function HelpDrawer() {
  const { isOpen, articleId, close } = useHelp()
  const [search, setSearch] = useState('')
  const [activeId, setActiveId] = useState(null)

  useEffect(() => {
    if (isOpen && articleId) setActiveId(articleId)
    if (!isOpen) {
      setSearch('')
      setActiveId(null)
    }
  }, [isOpen, articleId])

  const filtered = useMemo(() => {
    if (!search.trim()) return ARTICLES
    const q = search.toLowerCase()
    return ARTICLES.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.tags.some((t) => t.includes(q)) ||
        a.sections.some(
          (s) =>
            s.text.toLowerCase().includes(q) ||
            s.heading.toLowerCase().includes(q),
        ),
    )
  }, [search])

  const activeArticle = ARTICLES.find((a) => a.id === activeId)

  return (
    <Offcanvas
      show={isOpen}
      onHide={close}
      placement="end"
      aria-label="Help centre"
      style={{ width: 420, maxWidth: '100vw' }}
    >
      <Offcanvas.Header closeButton>
        <Offcanvas.Title className="d-flex align-items-center gap-2">
          <svg className="sa-icon" aria-hidden="true">
            <use href="/icons/sprite.svg#help-circle"></use>
          </svg>
          Help Centre
        </Offcanvas.Title>
      </Offcanvas.Header>

      <Offcanvas.Body className="d-flex flex-column p-0">
        <div className="p-3 border-bottom">
          <InputGroup size="sm">
            <InputGroup.Text aria-hidden="true">
              <svg className="sa-icon" style={{ width: 12, height: 12 }}>
                <use href="/icons/sprite.svg#search"></use>
              </svg>
            </InputGroup.Text>
            <Form.Control
              placeholder="Search help…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                if (e.target.value) setActiveId(null)
              }}
              aria-label="Search help articles"
            />
            {search && (
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                <svg className="sa-icon" style={{ width: 10, height: 10 }}>
                  <use href="/icons/sprite.svg#x"></use>
                </svg>
              </Button>
            )}
          </InputGroup>
        </div>

        {activeArticle && !search ? (
          <div className="flex-grow-1 overflow-auto p-3">
            <button
              type="button"
              className="btn btn-link btn-sm p-0 mb-3 text-muted text-decoration-none d-flex align-items-center gap-1"
              onClick={() => setActiveId(null)}
            >
              <svg className="sa-icon" style={{ width: 12, height: 12 }} aria-hidden="true">
                <use href="/icons/sprite.svg#chevron-left"></use>
              </svg>
              All articles
            </button>
            <h5 className="mb-3">{activeArticle.title}</h5>
            {activeArticle.sections.map((section, i) => (
              <div key={i} className="mb-4">
                <h6 className="fw-600 fs-sm mb-1">{section.heading}</h6>
                <p className="text-secondary fs-sm mb-0">{section.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-grow-1 overflow-auto" role="list">
            {filtered.length === 0 ? (
              <p className="text-muted text-center py-5 fs-sm px-3">
                No results for &ldquo;{search}&rdquo;
              </p>
            ) : (
              <ul className="list-unstyled mb-0">
                {filtered.map((article) => (
                  <li key={article.id} role="listitem">
                    <button
                      type="button"
                      className="btn btn-link text-start w-100 px-3 py-2 border-bottom text-decoration-none d-flex align-items-center justify-content-between"
                      onClick={() => setActiveId(article.id)}
                    >
                      <span className="fw-500 text-body fs-sm">{article.title}</span>
                      <svg
                        className="sa-icon text-muted flex-shrink-0"
                        style={{ width: 14, height: 14 }}
                        aria-hidden="true"
                      >
                        <use href="/icons/sprite.svg#chevron-right"></use>
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Offcanvas.Body>
    </Offcanvas>
  )
}
