"use client"
import { formatDate } from "@/lib/date-utils"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Edit, Trash2, Map, Play, ExternalLink, Pin } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface Episode {
  episode: number
  name: string
  start: string
  end: string
  public: boolean
}

interface Item {
  id: string
  active: boolean
  created: any
  deleted: boolean
  dh: string
  gl: string
  episodes: Episode[]
  orientation: string
  position: number
  road: string
  version: string
  updated?: any
  category_id?: string
  pinned?: boolean
}

interface GridViewProps {
  items: Item[]
  onEdit: (item: Item) => void
  onDelete: (item: Item) => void
  onPlayVideo: (item: Item) => void
  onManageEpisodes: (collection: string, itemId: string, episodes: Episode[]) => void
  collectionName: string
}

export function GridView({ items, onEdit, onDelete, onPlayVideo, onManageEpisodes, collectionName }: GridViewProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {items.map((item) => (
        <Card key={item.id} className={`overflow-hidden ${item.pinned ? "border-primary border-2 shadow-md" : ""}`}>
          <CardHeader className="p-4 pb-2">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg truncate" title={item.road}>
                  {item.road}
                </CardTitle>
                {item.pinned && <Pin className="h-4 w-4 text-primary fill-primary" />}
              </div>
              <Badge variant={item.deleted ? "destructive" : item.active ? "default" : "outline"} className="ml-2">
                {item.deleted ? "Deleted" : item.active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              {item.version && <span className="block">Version: {item.version}</span>}
              <span className="block">Position: {item.position}</span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex flex-col space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created:</span>
                <span>{formatDate(item.created?.toDate?.() || item.created)}</span>
              </div>
              {item.updated && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Updated:</span>
                  <span>{formatDate(item.updated?.toDate?.() || item.updated)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Episodes:</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 -mr-2"
                  onClick={() => onManageEpisodes(collectionName, item.id, item.episodes)}
                >
                  <Badge variant="outline" className="cursor-pointer hover:bg-secondary">
                    {Array.isArray(item.episodes) ? item.episodes.length : 0}
                  </Badge>
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="p-4 pt-0 flex flex-col space-y-2">
            <div className="flex justify-between w-full">
              {item.gl || item.dh ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full">
                      <Map className="h-4 w-4 mr-2" />
                      View Tour
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {item.gl && (
                      <DropdownMenuItem asChild>
                        <a
                          href={item.gl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center cursor-pointer"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open in new tab
                        </a>
                      </DropdownMenuItem>
                    )}
                    {item.dh && (
                      <DropdownMenuItem onClick={() => onPlayVideo(item)} className="flex items-center cursor-pointer">
                        <Play className="h-4 w-4 mr-2" />
                        Play in viewer
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button variant="outline" size="sm" disabled className="w-full">
                  <Map className="h-4 w-4 mr-2" />
                  No tour
                </Button>
              )}
            </div>
            <div className="flex justify-between w-full gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => onEdit(item)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-red-500 hover:text-red-700"
                onClick={() => onDelete(item)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
