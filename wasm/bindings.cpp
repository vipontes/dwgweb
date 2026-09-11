// Embind wrapper around dwgviewer's DwgDocument (src/dwg_document.h/.cpp,
// vendored unmodified below). DwgDocument itself has zero Qt dependency --
// this file is the only WASM-specific code, and it does nothing but expose
// DwgDocument's existing public surface (loadFile/shapes/boundingBox/
// errorMessage) plus the plain-struct Shape/Point2D/BoundingBox/etc. model
// to JS as structured values, so the JS side gets real objects/arrays
// instead of hand-marshalled flat buffers.
#include <emscripten/bind.h>
#include <emscripten/emscripten.h>
#include <clocale>

#include "dwg_document.h"

using namespace emscripten;

namespace {

// Loads a file already written into Emscripten's virtual FS (see parser.ts:
// the caller does FS.writeFile(path, bytes) before calling this) and returns
// a fresh DwgDocument. A value (not pointer) return lets embind copy the
// whole shapes_ vector out as a JS array of plain objects in one call,
// matching how the rest of this binding treats DwgDocument's model structs
// as values, not handles.
DwgDocument loadDwgFile(const std::string &path) {
    // dxfRW/dwgRW's number parsing uses locale-sensitive strtod() (see
    // dwgviewer's main.cpp for the native build's identical fix) and DXF/DWG
    // files always use '.' as the decimal separator regardless of the host
    // locale.
    std::setlocale(LC_NUMERIC, "C");
    DwgDocument doc;
    doc.loadFile(path);
    return doc;
}

} // namespace

EMSCRIPTEN_BINDINGS(dwg_module) {
    register_vector<Point2D>("VectorPoint2D");
    register_vector<double>("VectorDouble");
    register_vector<Shape>("VectorShape");
    register_vector<HatchLoop>("VectorHatchLoop");
    register_vector<HatchPatternLine>("VectorHatchPatternLine");

    value_object<Point2D>("Point2D")
        .field("x", &Point2D::x)
        .field("y", &Point2D::y);

    value_object<RgbColor>("RgbColor")
        .field("r", &RgbColor::r)
        .field("g", &RgbColor::g)
        .field("b", &RgbColor::b);

    enum_<ShapeKind>("ShapeKind")
        .value("Line", ShapeKind::Line)
        .value("Circle", ShapeKind::Circle)
        .value("Arc", ShapeKind::Arc)
        .value("Polyline", ShapeKind::Polyline)
        .value("Text", ShapeKind::Text)
        .value("Hatch", ShapeKind::Hatch);

    enum_<TextHAlign>("TextHAlign")
        .value("Left", TextHAlign::Left)
        .value("Center", TextHAlign::Center)
        .value("Right", TextHAlign::Right);

    enum_<TextVAlign>("TextVAlign")
        .value("Baseline", TextVAlign::Baseline)
        .value("Bottom", TextVAlign::Bottom)
        .value("Middle", TextVAlign::Middle)
        .value("Top", TextVAlign::Top);

    enum_<Shape::HatchFillKind>("HatchFillKind")
        .value("Solid", Shape::HatchFillKind::Solid)
        .value("Gradient", Shape::HatchFillKind::Gradient)
        .value("Pattern", Shape::HatchFillKind::Pattern);

    value_object<HatchLoop>("HatchLoop")
        .field("points", &HatchLoop::points)
        .field("bulges", &HatchLoop::bulges);

    value_object<HatchPatternLine>("HatchPatternLine")
        .field("angleRad", &HatchPatternLine::angleRad)
        .field("basePoint", &HatchPatternLine::basePoint)
        .field("offset", &HatchPatternLine::offset)
        .field("dashPattern", &HatchPatternLine::dashPattern);

    value_object<Shape>("Shape")
        .field("kind", &Shape::kind)
        .field("points", &Shape::points)
        .field("bulges", &Shape::bulges)
        .field("startWidths", &Shape::startWidths)
        .field("endWidths", &Shape::endWidths)
        .field("dashPattern", &Shape::dashPattern)
        .field("center", &Shape::center)
        .field("radius", &Shape::radius)
        .field("startAngleRad", &Shape::startAngleRad)
        .field("endAngleRad", &Shape::endAngleRad)
        .field("closed", &Shape::closed)
        .field("color", &Shape::color)
        .field("text", &Shape::text)
        .field("textHeightDoc", &Shape::textHeightDoc)
        .field("textAngleRad", &Shape::textAngleRad)
        .field("textHAlign", &Shape::textHAlign)
        .field("textVAlign", &Shape::textVAlign)
        .field("hatchLoops", &Shape::hatchLoops)
        .field("hatchFillKind", &Shape::hatchFillKind)
        .field("hatchColor2", &Shape::hatchColor2)
        .field("hatchGradientAngleRad", &Shape::hatchGradientAngleRad)
        .field("hatchPatternLines", &Shape::hatchPatternLines);

    value_object<BoundingBox>("BoundingBox")
        .field("minX", &BoundingBox::minX)
        .field("minY", &BoundingBox::minY)
        .field("maxX", &BoundingBox::maxX)
        .field("maxY", &BoundingBox::maxY);

    class_<DwgDocument>("DwgDocument")
        .constructor<>()
        .function("shapes", &DwgDocument::shapes)
        .function("boundingBox", &DwgDocument::boundingBox)
        .function("errorMessage", &DwgDocument::errorMessage);

    function("loadDwgFile", &loadDwgFile);
}
