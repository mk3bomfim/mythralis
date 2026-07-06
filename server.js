const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = path.join(__dirname, 'gallery');

const DB_DIR = path.join(__dirname, 'database');
const PEOPLE_DIR = path.join(DB_DIR, 'people');
const MEDIA_DIR = path.join(DB_DIR, 'media');
const MEDIA_FILES_DIR = path.join(DB_DIR, 'media_files');
const USERS_DIR = path.join(DB_DIR, 'users');
const INVITES_DIR = path.join(DB_DIR, 'invites');
const FOLDERS_DIR = path.join(DB_DIR, 'folders');

// Ensure directories exist
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR);
if (!fs.existsSync(PEOPLE_DIR)) fs.mkdirSync(PEOPLE_DIR);
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR);
if (!fs.existsSync(MEDIA_FILES_DIR)) fs.mkdirSync(MEDIA_FILES_DIR);
if (!fs.existsSync(USERS_DIR)) fs.mkdirSync(USERS_DIR);
if (!fs.existsSync(INVITES_DIR)) fs.mkdirSync(INVITES_DIR);
if (!fs.existsSync(FOLDERS_DIR)) fs.mkdirSync(FOLDERS_DIR);

const MIME = {
  '.html' : 'text/html; charset=utf-8',
  '.css'  : 'text/css',
  '.js'   : 'application/javascript',
  '.json' : 'application/json',
  '.png'  : 'image/png',
  '.jpg'  : 'image/jpeg',
  '.jpeg' : 'image/jpeg',
  '.gif'  : 'image/gif',
  '.webp' : 'image/webp',
  '.svg'  : 'image/svg+xml',
  '.mp4'  : 'video/mp4',
  '.webm' : 'video/webm',
  '.mov'  : 'video/quicktime',
  '.avi'  : 'video/x-msvideo',
  '.mkv'  : 'video/x-matroska',
  '.mp3'  : 'audio/mpeg',
  '.ico'  : 'image/x-icon',
};

function handleAPI(req, res, pathname, queryParams) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // GET /api/people
  if (pathname === '/api/people' && req.method === 'GET') {
    fs.readdir(PEOPLE_DIR, (err, files) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      if (jsonFiles.length === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([]));
        return;
      }
      
      const peopleList = [];
      let completed = 0;
      jsonFiles.forEach(file => {
        fs.readFile(path.join(PEOPLE_DIR, file), 'utf8', (err, data) => {
          if (!err) {
            try { peopleList.push(JSON.parse(data)); } catch (e) {}
          }
          completed++;
          if (completed === jsonFiles.length) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(peopleList));
          }
        });
      });
    });
    return;
  }

  // POST /api/people
  if (pathname === '/api/people' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const person = JSON.parse(body);
        if (!person.id) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing target id' }));
          return;
        }
        
        fs.writeFile(path.join(PEOPLE_DIR, `${person.id}.json`), JSON.stringify(person, null, 2), 'utf8', err => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, person }));
          }
        });
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
    });
    return;
  }

  // DELETE /api/people
  if (pathname === '/api/people' && req.method === 'DELETE') {
    const id = queryParams.get('id');
    if (!id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing target id param' }));
      return;
    }
    
    const personFile = path.join(PEOPLE_DIR, `${id}.json`);
    fs.unlink(personFile, err => {
      if (err && err.code !== 'ENOENT') {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      
      // Clean up associated media
      fs.readdir(MEDIA_DIR, (err, files) => {
        if (err) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          return;
        }
        
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        if (jsonFiles.length === 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          return;
        }
        
        let completed = 0;
        jsonFiles.forEach(file => {
          const mPath = path.join(MEDIA_DIR, file);
          fs.readFile(mPath, 'utf8', (err, data) => {
            if (!err) {
              try {
                const media = JSON.parse(data);
                if (media.personId === id) {
                  if (media.src && media.src.startsWith('/surveillance_media/')) {
                    const rawFileName = media.src.replace('/surveillance_media/', '');
                    const rawFilePath = path.join(MEDIA_FILES_DIR, rawFileName);
                    if (fs.existsSync(rawFilePath)) fs.unlinkSync(rawFilePath);
                  }
                  fs.unlinkSync(mPath);
                }
              } catch (e) {}
            }
            completed++;
            if (completed === jsonFiles.length) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true }));
            }
          });
        });
      });
    });
    return;
  }

  // GET /api/media
  if (pathname === '/api/media' && req.method === 'GET') {
    const personId = queryParams.get('personId');
    
    fs.readdir(MEDIA_DIR, (err, files) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      if (jsonFiles.length === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([]));
        return;
      }
      
      const mediaList = [];
      let completed = 0;
      jsonFiles.forEach(file => {
        fs.readFile(path.join(MEDIA_DIR, file), 'utf8', (err, data) => {
          if (!err) {
            try {
              const m = JSON.parse(data);
              if (!personId || m.personId === personId) {
                mediaList.push(m);
              }
            } catch (e) {}
          }
          completed++;
          if (completed === jsonFiles.length) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(mediaList));
          }
        });
      });
    });
    return;
  }

  // POST /api/media
  if (pathname === '/api/media' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const media = JSON.parse(body);
        if (!media.id || !media.personId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required media fields' }));
          return;
        }
        
        if (media.src && media.src.startsWith('data:')) {
          const matches = media.src.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, 'base64');
            
            const safeName = media.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const rawFileName = `${media.id}_${safeName}`;
            const rawFilePath = path.join(MEDIA_FILES_DIR, rawFileName);
            
            fs.writeFileSync(rawFilePath, buffer);
            media.src = `/surveillance_media/${rawFileName}`;
          }
        }
        
        fs.writeFile(path.join(MEDIA_DIR, `${media.id}.json`), JSON.stringify(media, null, 2), 'utf8', err => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, media }));
          }
        });
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
    });
    return;
  }

  // DELETE /api/media
  if (pathname === '/api/media' && req.method === 'DELETE') {
    const id = queryParams.get('id');
    if (!id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing media id' }));
      return;
    }
    
    const mPath = path.join(MEDIA_DIR, `${id}.json`);
    fs.readFile(mPath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Media file not found' }));
        return;
      }
      
      try {
        const media = JSON.parse(data);
        if (media.src && media.src.startsWith('/surveillance_media/')) {
          const rawFileName = media.src.replace('/surveillance_media/', '');
          const rawFilePath = path.join(MEDIA_FILES_DIR, rawFileName);
          if (fs.existsSync(rawFilePath)) fs.unlinkSync(rawFilePath);
        }
      } catch (e) {}
      
      fs.unlink(mPath, err => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        }
      });
    });
    return;
  }

  // GET /api/users
  if (pathname === '/api/users' && req.method === 'GET') {
    fs.readdir(USERS_DIR, (err, files) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      if (jsonFiles.length === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([]));
        return;
      }
      const usersList = [];
      let completed = 0;
      jsonFiles.forEach(file => {
        fs.readFile(path.join(USERS_DIR, file), 'utf8', (err, data) => {
          if (!err) {
            try { usersList.push(JSON.parse(data)); } catch(e) {}
          }
          completed++;
          if (completed === jsonFiles.length) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(usersList));
          }
        });
      });
    });
    return;
  }

  // POST /api/users
  if (pathname === '/api/users' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const user = JSON.parse(body);
        if (!user.id) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing user id' }));
          return;
        }
        fs.writeFile(path.join(USERS_DIR, `${user.id}.json`), JSON.stringify(user, null, 2), 'utf8', err => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, user }));
          }
        });
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
    });
    return;
  }

  // DELETE /api/users
  if (pathname === '/api/users' && req.method === 'DELETE') {
    const id = queryParams.get('id');
    if (!id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing user id' }));
      return;
    }
    fs.unlink(path.join(USERS_DIR, `${id}.json`), err => {
      if (err && err.code !== 'ENOENT') {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      }
    });
    return;
  }

  // GET /api/invites
  if (pathname === '/api/invites' && req.method === 'GET') {
    fs.readdir(INVITES_DIR, (err, files) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      if (jsonFiles.length === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([]));
        return;
      }
      const invitesList = [];
      let completed = 0;
      jsonFiles.forEach(file => {
        fs.readFile(path.join(INVITES_DIR, file), 'utf8', (err, data) => {
          if (!err) {
            try { invitesList.push(JSON.parse(data)); } catch(e) {}
          }
          completed++;
          if (completed === jsonFiles.length) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(invitesList));
          }
        });
      });
    });
    return;
  }

  // POST /api/invites
  if (pathname === '/api/invites' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const invite = JSON.parse(body);
        if (!invite.code) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing invite code' }));
          return;
        }
        fs.writeFile(path.join(INVITES_DIR, `${invite.code}.json`), JSON.stringify(invite, null, 2), 'utf8', err => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, invite }));
          }
        });
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
    });
    return;
  }

  // DELETE /api/invites
  if (pathname === '/api/invites' && req.method === 'DELETE') {
    const code = queryParams.get('code');
    if (!code) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing invite code' }));
      return;
    }
    fs.unlink(path.join(INVITES_DIR, `${code}.json`), err => {
      if (err && err.code !== 'ENOENT') {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      }
    });
    return;
  }

  // GET /api/folders
  if (pathname === '/api/folders' && req.method === 'GET') {
    fs.readdir(FOLDERS_DIR, (err, files) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      if (jsonFiles.length === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([]));
        return;
      }
      const foldersList = [];
      let completed = 0;
      jsonFiles.forEach(file => {
        fs.readFile(path.join(FOLDERS_DIR, file), 'utf8', (err, data) => {
          if (!err) {
            try { foldersList.push(JSON.parse(data)); } catch(e) {}
          }
          completed++;
          if (completed === jsonFiles.length) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(foldersList));
          }
        });
      });
    });
    return;
  }

  // POST /api/folders
  if (pathname === '/api/folders' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const folder = JSON.parse(body);
        if (!folder.id) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing folder id' }));
          return;
        }
        fs.writeFile(path.join(FOLDERS_DIR, `${folder.id}.json`), JSON.stringify(folder, null, 2), 'utf8', err => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, folder }));
          }
        });
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
    });
    return;
  }

  // DELETE /api/folders
  if (pathname === '/api/folders' && req.method === 'DELETE') {
    const id = queryParams.get('id');
    if (!id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing folder id' }));
      return;
    }
    fs.unlink(path.join(FOLDERS_DIR, `${id}.json`), err => {
      if (err && err.code !== 'ENOENT') {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
}

http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const pathname = parsedUrl.pathname;

  // Intercept API routes
  if (pathname.startsWith('/api/')) {
    handleAPI(req, res, pathname, parsedUrl.searchParams);
    return;
  }

  let urlPath = pathname;
  if (urlPath === '/') urlPath = '/index.html';

  // Serve icon.png or raw surveillance files
  let filePath;
  if (urlPath === '/icon.png') {
    filePath = path.join(__dirname, 'icon.png');
  } else if (urlPath.startsWith('/surveillance_media/')) {
    const rawFileName = urlPath.replace('/surveillance_media/', '');
    filePath = path.join(MEDIA_FILES_DIR, rawFileName);
  } else {
    filePath = path.join(ROOT, urlPath);
  }

  // Security: stay inside ROOT, project dir, or database dir
  if (!filePath.startsWith(ROOT) && !filePath.startsWith(__dirname) && !filePath.startsWith(DB_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404); res.end('Not found'); return;
    }

    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    const size = stat.size;

    // Range support (needed for video seeking / .mov)
    const range = req.headers['range'];
    if (range && mime.startsWith('video')) {
      const parts  = range.replace(/bytes=/, '').split('-');
      const start  = parseInt(parts[0], 10);
      const end    = parts[1] ? parseInt(parts[1], 10) : size - 1;
      const chunk  = end - start + 1;

      res.writeHead(206, {
        'Content-Range'  : `bytes ${start}-${end}/${size}`,
        'Accept-Ranges'  : 'bytes',
        'Content-Length' : chunk,
        'Content-Type'   : mime,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Type'   : mime,
        'Content-Length' : size,
        'Accept-Ranges'  : 'bytes',
        'Cache-Control'  : 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma'         : 'no-cache',
        'Expires'        : '0',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });

}).listen(PORT, '127.0.0.1', () => {
  console.log(`\n  TDN Server running at http://127.0.0.1:${PORT}\n`);
});
