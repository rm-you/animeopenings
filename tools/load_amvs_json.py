import json
import urllib2
import wx
import wx.grid

response = urllib2.urlopen('http://amvs.moe/videos.json')
data = json.load(response)

EDITOR_COL = 0
TITLE_COL = 1
FILENAME_COL = 2
SONG_ARTIST_COL = 3
SONG_TITLE_COL = 4
SUBTITLES_COL = 5

LIGHT_RED = (255, 105, 97)


class AMVListEditor(wx.Frame):
    def __init__(self):
        wx.Frame.__init__(self, parent=None, title="AMV List Editor")
        panel = wx.Panel(self)

        toolbar = self.CreateToolBar()
        save_item = toolbar.AddLabelTool(wx.ID_SAVE, 'Save', wx.Bitmap('save.png'))
        toolbar.Realize()

        self.grid = wx.grid.Grid(panel)
        self.grid.CreateGrid(0, 6)

        self.grid.SetColLabelValue(EDITOR_COL, "Editor")
        self.grid.SetColLabelValue(TITLE_COL, "Title")
        self.grid.SetColLabelValue(FILENAME_COL, "Filename")
        self.grid.SetColLabelValue(SONG_ARTIST_COL, "Song Artist")
        self.grid.SetColLabelValue(SONG_TITLE_COL, "Song Title")
        self.grid.SetColLabelValue(SUBTITLES_COL, "Subtitles")

        sizer = wx.BoxSizer(wx.VERTICAL)
        sizer.Add(self.grid, 1, wx.EXPAND)
        panel.SetSizer(sizer)

        # Normalize Data
        for editor_name in data:
            editor_videos = data[editor_name]
            for video_name in editor_videos:
                video = editor_videos[video_name]
                row = {
                    "editor": editor_name,
                    "title": video_name,
                    "file": video['file'],
                    "song_artist": video['song']['artist'],
                    "song_title": video['song']['title'],
                    "subtitles": video.get('subtitles', "")
                }
                self.append_row(row)
        self.grid.AppendRows(1)
        self.grid.AutoSize()

        self.SetSize((
            self.grid.GetBestSize()[0] + 33,
            800
        ))
        self.grid.SetWindowStyleFlag(self.grid.GetWindowStyleFlag() | wx.ALWAYS_SHOW_SB)

        self.Bind(wx.grid.EVT_GRID_CELL_CHANGE, self.OnCellChange)
        self.Bind(wx.grid.EVT_GRID_CELL_RIGHT_DCLICK, self.OnSave)
        self.Bind(wx.EVT_TOOL, self.OnSave, save_item)

    def OnSave(self, evt):
        self.dump_rows()
        evt.Skip()

    def OnCellChange(self, evt):
        rows = self.grid.GetNumberRows()
        if not self.row_empty(rows - 1):
            self.grid.AppendRows(1)
        evt.Skip()

    def row_empty(self, row):
        check = ""
        for i in range(self.grid.GetNumberCols()):
            check += self.grid.GetCellValue(row, i)
        return len(check) is 0

    def append_row(self, row_data):
        self.grid.AppendRows(1)
        row = self.grid.GetNumberRows() - 1
        self.grid.SetCellValue(row, EDITOR_COL, row_data["editor"])
        self.grid.SetCellValue(row, TITLE_COL, row_data["title"])
        self.grid.SetCellValue(row, FILENAME_COL, row_data["file"])
        self.grid.SetCellValue(row, SONG_ARTIST_COL, row_data["song_artist"])
        self.grid.SetCellValue(row, SONG_TITLE_COL, row_data["song_title"])
        self.grid.SetCellValue(row, SUBTITLES_COL, row_data["subtitles"])

    def get_row(self, row):
        vals = {
            "editor": self.grid.GetCellValue(row, EDITOR_COL),
            "title": self.grid.GetCellValue(row, TITLE_COL),
            "file": self.grid.GetCellValue(row, FILENAME_COL),
            "song_artist": self.grid.GetCellValue(row, SONG_ARTIST_COL),
            "song_title": self.grid.GetCellValue(row, SONG_TITLE_COL),
            "subtitles": self.grid.GetCellValue(row, SUBTITLES_COL),
        }
        return vals

    @staticmethod
    def validate_row(row):
        invalid = []
        if not row['editor']: invalid.append(EDITOR_COL)
        if not row['title']: invalid.append(TITLE_COL)
        if not row['file']: invalid.append(FILENAME_COL)
        if not row['song_artist']: invalid.append(SONG_ARTIST_COL)
        if not row['song_title']: invalid.append(SONG_TITLE_COL)
        return invalid

    def highlight_cells(self, row, columns):
        for c in columns:
            self.grid.SetCellBackgroundColour(row, c, LIGHT_RED)
        self.Refresh()

    def reset_cells(self):
        rows = self.grid.GetNumberRows()
        cols = self.grid.GetNumberCols()
        for i in range(rows):
            for j in range(cols):
                self.grid.SetCellBackgroundColour(i, j, wx.WHITE)
        self.Refresh()

    def dump_rows(self, start=0, end=None):
        all_data = {}
        self.reset_cells()
        if not end:
            end = self.grid.GetNumberRows()
        for i in range(start, end):
            if self.row_empty(i):
                continue
            row = self.get_row(i)
            bad_columns = self.validate_row(row)
            if bad_columns:
                self.highlight_cells(i, bad_columns)
            else:
                if row['editor'] not in all_data:
                    all_data[row['editor']] = {}
                all_data[row['editor']][row['title']] = {
                    'file': row['file'],
                    'song': {
                        'artist': row['song_artist'],
                        'title': row['song_title'],
                    }
                }
                if row['subtitles']:
                    all_data[row['editor']][row['title']]['subtitles'] = row['subtitles']
        pretty_data = json.dumps(all_data, sort_keys=True, indent=4)
        f = open("videos.json", 'w')
        f.write(pretty_data)
        f.close()


if __name__ == "__main__":
    app = wx.PySimpleApp()
    frame = AMVListEditor().Show()
    app.MainLoop()
