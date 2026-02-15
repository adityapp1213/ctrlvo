from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
from PIL import Image, ImageDraw, ImageFont
import io
import base64


class MemoryRequest(BaseModel):
  chatId: str
  heading: str
  body: str


class MemoryResponse(BaseModel):
  imageBase64: str


def _create_image(heading: str, body: str) -> bytes:
  width, height = 800, 600
  background_color = (15, 23, 42)
  heading_color = (248, 250, 252)
  text_color = (148, 163, 184)

  image = Image.new("RGB", (width, height), color=background_color)
  draw = ImageDraw.Draw(image)

  try:
    heading_font = ImageFont.truetype("arial.ttf", 36)
    body_font = ImageFont.truetype("arial.ttf", 24)
  except OSError:
    heading_font = ImageFont.load_default()
    body_font = ImageFont.load_default()

  margin_x = 40
  current_y = 40

  draw.text((margin_x, current_y), heading, font=heading_font, fill=heading_color)
  bbox = heading_font.getbbox(heading)
  heading_height = bbox[3] - bbox[1] if bbox else 40
  current_y += heading_height + 24

  max_width = width - 2 * margin_x

  def wrap(text: str) -> list[str]:
    words = text.split()
    if not words:
      return []
    lines = []
    current_line: list[str] = []
    for word in words:
      trial = " ".join(current_line + [word])
      trial_width = body_font.getbbox(trial)[2]
      if trial_width <= max_width or not current_line:
        current_line.append(word)
      else:
        lines.append(" ".join(current_line))
        current_line = [word]
    if current_line:
      lines.append(" ".join(current_line))
    return lines

  for raw_line in body.splitlines():
    text_line = raw_line.strip()
    if not text_line:
      current_y += 12
      continue
    wrapped = wrap(text_line)
    for line in wrapped:
      draw.text((margin_x, current_y), line, font=body_font, fill=text_color)
      bbox = body_font.getbbox(line)
      line_height = bbox[3] - bbox[1] if bbox else 24
      current_y += line_height + 6
      if current_y > height - 40:
        break
    if current_y > height - 40:
      break

  buffer = io.BytesIO()
  image.save(buffer, format="PNG")
  return buffer.getvalue()


app = FastAPI()


@app.post("/memory", response_model=MemoryResponse)
async def generate_memory(req: MemoryRequest):
  image_bytes = _create_image(req.heading, req.body)
  encoded = base64.b64encode(image_bytes).decode("ascii")
  return MemoryResponse(imageBase64=encoded)

